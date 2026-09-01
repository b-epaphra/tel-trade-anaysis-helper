import { Agent } from "@earendil-works/pi-agent-core";
import { streamSimple } from "@earendil-works/pi-ai/api/openai-completions";
import { Model } from "@earendil-works/pi-ai";
import { SIGNALPROOF_AGENT_TOOLS } from "../src/lib/agent/tools.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const apiKey = process.env.LITELLM_API_KEY || "sk-0DFMWnbmyvO3WaotuvN3TA";
const baseUrl = process.env.LITELLM_BASE_URL || "https://litellm-database-production-369d.up.railway.app/v1";
const modelId = process.env.LITELLM_MODEL || "DeepSeek-V4-Flash";

const model: Model<"openai-completions"> = {
  id: modelId,
  name: "DeepSeek V4 Flash",
  api: "openai-completions",
  provider: "litellm",
  baseUrl: baseUrl,
  input: ["text"],
  reasoning: false,
  compat: {
    supportsUsageInStreaming: true,
    supportsFinishReason: true,
    supportsStrictMode: false,
    maxTokensField: "max_tokens",
  },
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  maxTokens: 4096,
  contextWindow: 128000,
};

const agent = new Agent({
  initialState: {
    systemPrompt: `You are the Chief Quantitative Auditor at SignalProof™ — the forensic signal verification authority for financial trading. You audit Telegram trading channels and signals. Use your tools to query channel stats and trades when needed. Always output institutional quantitative findings in clean markdown.`,
    model: model,
    thinkingLevel: "off",
    tools: SIGNALPROOF_AGENT_TOOLS,
  },
  streamFn: (m, ctx, opts) => {
    return streamSimple(m as any, ctx, {
      ...opts,
      apiKey: apiKey,
    });
  },
});

async function main() {
  console.log("Sending prompt to Agent...");
  await agent.prompt("Check the stats for channel -1001297305044 and provide an executive summary.");
  await agent.waitForIdle();
  const lastMsg = agent.state.messages[agent.state.messages.length - 1];
  console.log("\n=== FINAL AGENT RESPONSE ===\n");
  console.log(JSON.stringify(lastMsg, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});