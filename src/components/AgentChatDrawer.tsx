"use client";

import { useState, useRef, useEffect } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  Bot,
  Sparkles,
  Send,
  X,
  RefreshCw,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Sliders,
  Database,
  ExternalLink,
  HelpCircle,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  BrainCircuit,
  Square,
  Zap,
  Activity,
  ArrowDown,
} from "lucide-react";

export interface AgentChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  adminPassword?: string;
  onSelectTrade?: (tradeId: number) => void;
}

interface ToolCallState {
  toolCallId?: string;
  toolName: string;
  args?: any;
  result?: any;
  status: "running" | "done" | "error";
  startTime?: number;
  endTime?: number;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  isThinking?: boolean;
  thinkingDurationMs?: number;
  tools?: ToolCallState[];
  usage?: {
    input?: number;
    output?: number;
    reasoning?: number;
    totalTokens?: number;
  };
  timestamp: number;
}

export default function AgentChatDrawer({
  isOpen,
  onClose,
  channelId,
  adminPassword = "",
  onSelectTrade,
}: AgentChatDrawerProps) {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `### 🛡️ SignalProof™ Forensic AI Agent\n\nI am initialized on the **Pi Agent Harness** and connected to **LiteLLM proxy** running \`DeepSeek-V4-Flash\` with streaming events and reasoning support.\n\n**Forensic Capabilities:**\n- 📊 **Channel Audits:** Calculate real tick-by-tick win rate against claimed win rate.\n- 🚨 **Fraud Pinpointing:** Detect phantom wins, moving stop-losses, and retroactive claim edits.\n- 🔍 **Trade Forensics:** Inspect exact entry slippage, SL/TP triggers, and tick extremes.\n- 📈 **Signal Backtesting:** Run 1-minute historical tick simulations on arbitrary trading signals.\n\n*Click any quick audit prompt below or ask a question to begin.*`,
      timestamp: Date.now(),
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Model & Reasoning Settings
  const [modelId, setModelId] = useState("DeepSeek-V4-Flash");
  const [thinkingLevel, setThinkingLevel] = useState<"off" | "low" | "medium" | "high">("off");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track expanded tools & thinking accordions by message ID
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom("auto");
    }
  }, [isOpen]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isNearBottom);
  };

  const quickPrompts = [
    {
      label: "📊 Full Channel Audit",
      prompt: `Perform an institutional quantitative audit for channel ${channelId}. Provide verified win rate vs claimed win rate, total verified signals, fraud count, and a final verdict dossier.`,
    },
    {
      label: "🚨 Find Phantom Wins & Fraud",
      prompt: `Audit all detected frauds in channel ${channelId}. List trades where provider claimed a win but the market never hit TP or was stopped out.`,
    },
    {
      label: "⚖️ Real vs Claimed Win Rate",
      prompt: `Compare the provider's claimed win rate with our tick-by-tick verified win rate for channel ${channelId}. What is the mathematical discrepancy?`,
    },
    {
      label: "🥇 Audit Gold (XAUUSD)",
      prompt: `Query all signals for GOLD / XAUUSD in channel ${channelId}. Break down win rate, average duration, and check for slippage.`,
    },
    {
      label: "⏱️ Holding Duration & Risk Profile",
      prompt: `What is the average trade duration and holding time for channel ${channelId}? Are there expired or stalled trades?`,
    },
  ];

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    // Create abort controller for streaming cancellation
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue("");
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: MessageItem = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      reasoning: "",
      isThinking: thinkingLevel !== "off",
      tools: [],
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    let thinkingStartTime = Date.now();
    let streamText = "";
    let streamReasoning = "";
    const currentTools: ToolCallState[] = [];

    try {
      const pass =
        adminPassword ||
        (typeof window !== "undefined" ? localStorage.getItem("admin_password") : null) ||
        "admin123";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (pass) {
        headers["x-admin-password"] = pass;
      }

      // Convert messages for API, omitting local welcome greeting
      const apiMessages = newMessages
        .filter((m) => m.role !== "system" && m.id !== "welcome" && m.id !== "welcome-reset")
        .map((m) => ({
          role: m.role,
          content: [{ type: "text", text: m.content }],
          usage: m.usage || {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          timestamp: m.timestamp,
        }));

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers,
        signal: abortController.signal,
        body: JSON.stringify({
          channelId,
          messages: apiMessages,
          prompt: text,
          modelId: modelId || "DeepSeek-V4-Flash",
          thinkingLevel: thinkingLevel || "off",
          apiKey: customApiKey || undefined,
          baseURL: customBaseUrl || undefined,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const rawLines = buffer.split(/\r?\n/);
          buffer = rawLines.pop() || "";

          for (const line of rawLines) {
            const cleanLine = line.trim();
            if (!cleanLine.startsWith("data:")) continue;
            const jsonStr = cleanLine.replace(/^data:\s*/, "");
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

                if (event.type === "thinking_start") {
                  thinkingStartTime = Date.now();
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, isThinking: true } : m
                    )
                  );
                } else if (event.type === "thinking_delta") {
                  streamReasoning += event.delta;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            reasoning: streamReasoning,
                            isThinking: true,
                            thinkingDurationMs: Date.now() - thinkingStartTime,
                          }
                        : m
                    )
                  );
                } else if (event.type === "thinking_end") {
                  streamReasoning = event.content || streamReasoning;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            reasoning: streamReasoning,
                            isThinking: false,
                            thinkingDurationMs: Date.now() - thinkingStartTime,
                          }
                        : m
                    )
                  );
                } else if (event.type === "tool_start") {
                  currentTools.push({
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    args: event.args,
                    status: "running",
                    startTime: Date.now(),
                  });
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, tools: [...currentTools], isThinking: false }
                        : m
                    )
                  );
                } else if (event.type === "tool_end") {
                  const target = currentTools.find(
                    (t) => t.toolName === event.toolName && t.status === "running"
                  );
                  if (target) {
                    target.status = event.isError ? "error" : "done";
                    target.result = event.result;
                    target.endTime = Date.now();
                  }
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, tools: [...currentTools] }
                        : m
                    )
                  );
                } else if (event.type === "text_delta") {
                  streamText += event.delta;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: streamText, isThinking: false }
                        : m
                    )
                  );
                } else if (event.type === "done") {
                  streamText = event.text || streamText;
                  streamReasoning = event.reasoning || streamReasoning;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content: streamText,
                            reasoning: streamReasoning,
                            isThinking: false,
                            usage: event.usage,
                          }
                        : m
                    )
                  );
                } else if (event.type === "error") {
                  streamText += `\n\n> ❌ **Agent Error**: ${event.error}`;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: streamText, isThinking: false }
                        : m
                    )
                  );
                }
              } catch (e) {
                console.warn("Error parsing stream chunk:", e);
              }
            }
          }
        }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: streamText + "\n\n*(Generation stopped by user)*",
                  isThinking: false,
                }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `❌ **Failed to communicate with Agent:** ${err.message || "Unknown error"}`,
                  isThinking: false,
                }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm("Reset Agent conversation history?")) {
      setMessages([
        {
          id: "welcome-reset",
          role: "assistant",
          content: `🔄 **Chat session reset.** Ready to inspect and audit Telegram Channel \`${channelId}\`!`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const toggleThought = (msgId: string) => {
    setExpandedThoughts((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleTool = (toolKey: string) => {
    setExpandedTools((prev) => ({ ...prev, [toolKey]: !prev[toolKey] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-md transition-all duration-300">
      <div
        className={`flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl h-full transition-all duration-300 relative ${
          isExpanded ? "w-full md:w-[85vw] lg:w-[80vw]" : "w-full md:w-[680px]"
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 shadow-lg shadow-indigo-500/25 text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">SignalProof™ Agent</h3>
                <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Pi Harness Active
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>LiteLLM</span>
                <span>•</span>
                <span className="text-indigo-400 font-mono font-medium">{modelId}</span>
                <span>•</span>
                <span className="text-slate-400">Reasoning: <b className="text-purple-400">{thinkingLevel.toUpperCase()}</b></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Agent & Model Settings"
              className={`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
                showSettings ? "bg-slate-800 text-indigo-400 border border-indigo-500/30" : ""
              }`}
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearHistory}
              title="Reset Conversation"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse width" : "Expand width"}
              className="hidden md:flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title="Close Drawer"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Model & Reasoning Config Drawer */}
        {showSettings && (
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/95 text-xs space-y-3 shrink-0 shadow-inner">
            <div className="flex items-center justify-between text-slate-200 font-bold">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Pi Harness & LiteLLM Settings
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Proxy credentials secured in backend</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-[11px] block mb-1 font-semibold">Model Selection</label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="DeepSeek-V4-Flash">DeepSeek-V4-Flash (Default)</option>
                  <option value="DeepSeek-V4-Pro">DeepSeek-V4-Pro</option>
                  <option value="DeepSeek-V4-Flash-0731">DeepSeek-V4-Flash-0731</option>
                  <option value="qwen/qwen3.7-flash">qwen/qwen3.7-flash</option>
                  <option value="gpt-5.6-terra">gpt-5.6-terra</option>
                  <option value="gpt-5.6-luna">gpt-5.6-luna</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1 font-semibold">Reasoning / Thinking Level</label>
                <div className="grid grid-cols-4 gap-1">
                  {(["off", "low", "medium", "high"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setThinkingLevel(level)}
                      className={`py-1.5 rounded-lg text-center font-mono text-[11px] uppercase font-bold transition-all ${
                        thinkingLevel === level
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "bg-slate-900 text-slate-400 hover:text-white border border-slate-700"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Action Chips Bar */}
        <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/50 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" /> Audit:
          </span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => handleSend(qp.prompt)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-indigo-950/80 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-200 border border-slate-700/60 transition-all font-medium disabled:opacity-50 active:scale-95"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Message Thread Scroll Area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-5 space-y-5"
        >
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const hasReasoning = Boolean(msg.reasoning || msg.isThinking);
            const isThoughtExpanded = expandedThoughts[msg.id] !== false;

            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}
              >
                {/* Sender Tag */}
                <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500 font-medium">
                  {isUser ? (
                    <span>You</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <Bot className="w-3 h-3" />
                      SignalProof Quantitative Auditor
                    </span>
                  )}
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                </div>

                {/* Message Bubble Body */}
                <div
                  className={`max-w-[94%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-sm shadow-slate-950/50"
                  }`}
                >
                  {/* Reasoning / Chain of Thought Block */}
                  {hasReasoning && (
                    <div className="mb-3.5 rounded-xl border border-purple-500/25 bg-purple-950/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleThought(msg.id)}
                        className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-purple-300 hover:bg-purple-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <BrainCircuit className={`w-3.5 h-3.5 text-purple-400 ${msg.isThinking ? "animate-spin" : ""}`} />
                          <span>
                            {msg.isThinking
                              ? "Deep Reasoning in Progress..."
                              : `Reasoning Chain ${msg.thinkingDurationMs ? `(${Math.round(msg.thinkingDurationMs / 100) / 10}s)` : ""}`}
                          </span>
                        </div>
                        {isThoughtExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isThoughtExpanded && (
                        <div className="px-3.5 py-2.5 border-t border-purple-500/20 bg-slate-950/60 font-mono text-[11px] text-purple-200/90 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
                          {msg.reasoning || "Thinking..."}
                          {msg.isThinking && <span className="inline-block w-1.5 h-3 bg-purple-400 animate-pulse ml-1" />}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool Execution Cards */}
                  {msg.tools && msg.tools.length > 0 && (
                    <div className="mb-3.5 space-y-2">
                      {msg.tools.map((tool, tIdx) => {
                        const toolKey = `${msg.id}-tool-${tIdx}`;
                        const isToolExpanded = Boolean(expandedTools[toolKey]);

                        return (
                          <div
                            key={tIdx}
                            className="rounded-xl border border-slate-700/80 bg-slate-950/80 overflow-hidden shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => toggleTool(toolKey)}
                              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs text-slate-300 hover:bg-slate-900 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="font-mono font-bold text-indigo-300">{tool.toolName}</span>
                                {tool.status === "running" ? (
                                  <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> executing...
                                  </span>
                                ) : tool.status === "error" ? (
                                  <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full font-semibold">
                                    ✕ error
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                                    ✓ verified ({tool.endTime && tool.startTime ? `${tool.endTime - tool.startTime}ms` : "done"})
                                  </span>
                                )}
                              </div>
                              {isToolExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                            </button>

                            {isToolExpanded && (
                              <div className="p-3.5 border-t border-slate-800 bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-56">
                                <div className="text-slate-500 mb-1 font-sans text-xs">Arguments:</div>
                                <pre className="text-slate-300 bg-slate-900/80 p-2 rounded-lg mb-2">{JSON.stringify(tool.args, null, 2)}</pre>
                                {tool.result && (
                                  <>
                                    <div className="text-slate-500 mb-1 font-sans text-xs">Returned Forensic Data:</div>
                                    <pre className="text-emerald-300 bg-slate-900/80 p-2 rounded-lg">{JSON.stringify(tool.result, null, 2)}</pre>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Main Message Markdown Body */}
                  {msg.content ? (
                    <MarkdownRenderer
                      content={msg.content}
                      onSelectTrade={onSelectTrade}
                    />
                  ) : msg.isThinking ? (
                    <div className="flex items-center gap-2 text-purple-300 text-xs py-1 italic">
                      <BrainCircuit className="w-4 h-4 animate-spin text-purple-400" />
                      Formulating quantitative forensic proof...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-indigo-300 text-xs py-1 italic">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      Executing tools & inspecting tick dataset...
                    </div>
                  )}
                </div>

                {/* Footer Actions & Token Usage Stats */}
                {!isUser && msg.content && (
                  <div className="flex items-center justify-between w-full max-w-[94%] px-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCopy(msg.content, index)}
                        className="hover:text-slate-300 flex items-center gap-1 transition-colors"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Markdown</span>
                          </>
                        )}
                      </button>
                    </div>

                    {msg.usage && (
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        <span>Tokens: {msg.usage.totalTokens || (msg.usage.input || 0) + (msg.usage.output || 0)}</span>
                        {msg.usage.reasoning ? <span>• Reasoning: {msg.usage.reasoning}</span> : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll To Bottom Button */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-8 p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-all active:scale-95 z-10"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Input Composer Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/95 shrink-0 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2.5"
          >
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                disabled={isLoading}
                placeholder="Ask the Agent about channel metrics, fraud detection, trade anomalies, or request a complete audit..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50"
              />
            </div>

            {isLoading ? (
              <button
                type="button"
                onClick={handleStop}
                className="h-12 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-medium flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-rose-600/20 text-xs active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="h-12 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 disabled:shadow-none disabled:text-slate-600 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Pi Agent Runtime • Dukascopy 1m Tick Verified</span>
            </span>
            <span>Target: <b className="text-slate-400 font-mono">{channelId}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}