import { Agent, AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
import { streamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import { Model } from "@earendil-works/pi-ai";
import { SIGNALPROOF_AGENT_TOOLS } from "./tools";

export interface AgentRunOptions {
  channelId?: string;
  modelId?: string;
  customApiKey?: string;
  customBaseUrl?: string;
  thinkingLevel?: ThinkingLevel;
  onEvent?: (event: any) => void;
}

/**
 * Creates and configures the SignalProof™ Pi Agent Harness.
 * Uses LiteLLM proxy (DeepSeek-V4-Flash) by default, stripped of generic coding tools/prompts.
 */
export function createSignalProofAgent(options: AgentRunOptions = {}) {
  const apiKey = options.customApiKey || process.env.LITELLM_API_KEY || "sk-0DFMWnbmyvO3WaotuvN3TA";
  const baseUrl = options.customBaseUrl || process.env.LITELLM_BASE_URL || "https://litellm-database-production-369d.up.railway.app/v1";
  const modelId = options.modelId || process.env.LITELLM_MODEL || "DeepSeek-V4-Flash";
  const thinkingLevel: ThinkingLevel = options.thinkingLevel || "off";

  const isReasoningEnabled = thinkingLevel !== "off";

  const model: Model<"openai-completions"> = {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: "litellm",
    baseUrl: baseUrl,
    input: ["text"],
    reasoning: isReasoningEnabled,
    compat: {
      supportsUsageInStreaming: true,
      supportsFinishReason: true,
      supportsStrictMode: false,
      maxTokensField: "max_tokens",
      thinkingFormat: "deepseek",
      supportsReasoningEffort: true,
    },
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    maxTokens: 4096,
    contextWindow: 128000,
  };

  const channelContext = options.channelId ? `Target Telegram Channel ID: ${options.channelId}` : "";

  const systemPrompt = `You are the Chief Quantitative Auditor and Forensic Trading Intelligence Agent at SignalProof™ — the forensic signal verification authority for financial trading.
You have ingested the Telegram channel's trading signals and simulated their executions tick-by-tick against Dukascopy 1-minute historical tick data.

${channelContext}

Your mission:
1. Provide institutional-grade quantitative audits, forensic trade reviews, and fraud investigations.
2. Use your tools actively to inspect empirical facts:
   - 'get_channel_stats': Computes true verified win rate, provider claimed win rate, discrepancy, completed trade counts, and fraud rate.
   - 'query_trades': Searches trading signals by asset, status (WIN, LOSS, ACTIVE, FRAUD, etc.), or date.
   - 'inspect_trade': Detailed forensic breakdown of a single trade by messageId (exact entry, tick slippage, SL/TP levels, price extremes, claim messages).
   - 'search_raw_messages': Retrieves original raw Telegram messages to check provider announcements, edited posts, or marketing claims.
   - 'list_detected_frauds': Pinpoints phantom wins, retroactive stop-loss modifications, and post-hoc entry claims.
   - 'simulate_signal': Runs tick-by-tick Dukascopy simulation on arbitrary signal parameters.
3. Always cite hard evidence (Message IDs, exact prices, timestamps, slippage in pips, and specific discrepancies).
4. Maintain an objective, institutional, forensic tone. Format findings with clear Markdown headers, comparison tables, and highlighted risk alerts.`;

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      thinkingLevel,
      tools: SIGNALPROOF_AGENT_TOOLS,
    },
    streamFn: (m, ctx, opts) => {
      return streamSimple(m as any, ctx, {
        ...opts,
        apiKey,
        reasoning: thinkingLevel !== "off" ? thinkingLevel : undefined,
      });
    },
  });

  if (options.onEvent) {
    agent.subscribe(options.onEvent);
  }

  return agent;
}

/**
 * Executes a conversation turn through the Pi Agent Harness.
 */
export async function executeAgentTurn(
  messages: AgentMessage[],
  promptText: string,
  options: AgentRunOptions = {}
): Promise<{ messages: AgentMessage[]; finalMessage: any }> {
  const agent = createSignalProofAgent(options);

  if (messages && messages.length > 0) {
    agent.state.messages = [...messages];
  }

  await agent.prompt(promptText);
  await agent.waitForIdle();

  const finalMessages = agent.state.messages;
  const lastAssistantMsg = finalMessages.slice().reverse().find((m: any) => m.role === "assistant");

  return {
    messages: finalMessages,
    finalMessage: lastAssistantMsg,
  };
}