import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth";
import { createSignalProofAgent } from "@/lib/agent/pi-harness";

export const dynamic = "force-dynamic";

function sanitizeConversationHistory(rawMessages: any[]): any[] {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .filter((m) => m && m.role !== "system" && m.id !== "welcome" && m.id !== "welcome-reset")
    .map((m) => {
      const content = Array.isArray(m.content)
        ? m.content
        : [{ type: "text", text: typeof m.content === "string" ? m.content : "" }];

      if (m.role === "assistant") {
        return {
          role: "assistant",
          content,
          usage: m.usage || {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: m.stopReason || "stop",
          timestamp: m.timestamp || Date.now(),
        };
      }
      return {
        role: m.role || "user",
        content,
        timestamp: m.timestamp || Date.now(),
      };
    });
}

export async function POST(req: Request) {
  try {
    const auth = verifyAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const {
      messages = [],
      prompt,
      channelId = "-1001297305044",
      modelId,
      apiKey,
      baseURL,
      thinkingLevel = "off",
      stream = true,
    } = await req.json();

    if (!prompt && (!messages || messages.length === 0)) {
      return NextResponse.json({ error: "Prompt or message history is required" }, { status: 400 });
    }

    const targetPrompt = prompt || (messages[messages.length - 1]?.content?.[0]?.text || "");

    // If streaming response is requested (SSE)
    if (stream) {
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();
      let isAborted = false;

      req.signal?.addEventListener("abort", () => {
        isAborted = true;
      });

      // Force Next.js / Nginx to flush headers and start streaming by sending an initial padding chunk
      try {
        writer.write(encoder.encode(':' + ' '.repeat(2048) + '\n\n'));
      } catch {}

      const sendEvent = async (data: any) => {
        if (isAborted || req.signal?.aborted) return;
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          await writer.write(encoder.encode(payload));
        } catch (e: any) {
          isAborted = true;
        }
      };

      // Run agent asynchronously in background and pipe events to SSE
      (async () => {
        let agent: any = null;
        try {
          await sendEvent({ type: "agent_start" });

          agent = createSignalProofAgent({
            channelId,
            modelId: modelId || process.env.LITELLM_MODEL || "DeepSeek-V4-Flash",
            customApiKey: apiKey,
            customBaseUrl: baseURL,
            thinkingLevel: thinkingLevel || "off",
            onEvent: async (event: any) => {
              if (isAborted || req.signal?.aborted) {
                try { agent?.abort?.(); } catch {}
                return;
              }

              if (event.type === "turn_start") {
                await sendEvent({ type: "turn_start" });
              } else if (event.type === "turn_end") {
                await sendEvent({ type: "turn_end" });
              } else if (event.type === "tool_execution_start") {
                await sendEvent({
                  type: "tool_start",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  args: event.args,
                });
              } else if (event.type === "tool_execution_update") {
                await sendEvent({
                  type: "tool_update",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  partialResult: event.partialResult,
                });
              } else if (event.type === "tool_execution_end") {
                await sendEvent({
                  type: "tool_end",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  result: event.result?.details !== undefined ? event.result.details : event.result,
                  isError: event.isError,
                });
              } else if (event.type === "message_update") {
                const subEvent = event.assistantMessageEvent;
                if (subEvent) {
                  if (subEvent.type === "thinking_start") {
                    await sendEvent({ type: "thinking_start" });
                  } else if (subEvent.type === "thinking_delta") {
                    await sendEvent({ type: "thinking_delta", delta: subEvent.delta });
                  } else if (subEvent.type === "thinking_end") {
                    await sendEvent({ type: "thinking_end", content: subEvent.content });
                  } else if (subEvent.type === "text_start") {
                    await sendEvent({ type: "text_start" });
                  } else if (subEvent.type === "text_delta") {
                    await sendEvent({ type: "text_delta", delta: subEvent.delta });
                  } else if (subEvent.type === "text_end") {
                    await sendEvent({ type: "text_end", content: subEvent.content });
                  }
                }
              } else if (event.type === "text_delta") {
                await sendEvent({
                  type: "text_delta",
                  delta: event.delta,
                });
              }
            },
          });

          // Set existing conversation history
          const sanitizedHistory = sanitizeConversationHistory(messages);
          if (sanitizedHistory.length > 0) {
            agent.state.messages = sanitizedHistory;
          }

          await agent.prompt(targetPrompt);
          await agent.waitForIdle();

          if (isAborted || req.signal?.aborted) return;

          const finalMessages = agent.state.messages;
          const lastAssistant = finalMessages.slice().reverse().find((m: any) => m.role === "assistant");
          const finalText = (lastAssistant as any)?.content
            ?.filter((c: any) => c.type === "text")
            ?.map((c: any) => c.text)
            ?.join("") || "";
          const reasoningText = (lastAssistant as any)?.content
            ?.filter((c: any) => c.type === "thinking")
            ?.map((c: any) => c.thinking)
            ?.join("") || "";

          await sendEvent({
            type: "done",
            text: finalText,
            reasoning: reasoningText || undefined,
            usage: (lastAssistant as any)?.usage,
            messages: finalMessages,
          });
        } catch (err: any) {
          if (!isAborted && !req.signal?.aborted) {
            console.error("Agent execution error in SSE stream:", err);
            await sendEvent({
              type: "error",
              error: err.message || "Agent execution failed",
            });
          }
        } finally {
          try {
            await writer.close();
          } catch {}
        }
      })();

      return new Response(responseStream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Non-streaming JSON mode fallback
    const agent = createSignalProofAgent({
      channelId,
      modelId: modelId || process.env.LITELLM_MODEL || "DeepSeek-V4-Flash",
      customApiKey: apiKey,
      customBaseUrl: baseURL,
      thinkingLevel: thinkingLevel || "off",
    });

    const sanitizedHistory = sanitizeConversationHistory(messages);
    if (sanitizedHistory.length > 0) {
      agent.state.messages = sanitizedHistory;
    }

    await agent.prompt(targetPrompt);
    await agent.waitForIdle();

    const finalMessages = agent.state.messages;
    const lastAssistant = finalMessages.slice().reverse().find((m: any) => m.role === "assistant");
    const text = (lastAssistant as any)?.content
      ?.filter((c: any) => c.type === "text")
      ?.map((c: any) => c.text)
      ?.join("") || "";
    const reasoning = (lastAssistant as any)?.content
      ?.filter((c: any) => c.type === "thinking")
      ?.map((c: any) => c.thinking)
      ?.join("") || "";

    return NextResponse.json({
      success: true,
      text,
      reasoning: reasoning || undefined,
      usage: (lastAssistant as any)?.usage,
      messages: finalMessages,
      model: modelId || process.env.LITELLM_MODEL || "DeepSeek-V4-Flash",
    });
  } catch (error: any) {
    console.error("Agent chat endpoint error:", error);
    return NextResponse.json({ error: error.message || "Failed to run agent" }, { status: 500 });
  }
}