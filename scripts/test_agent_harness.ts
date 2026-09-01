import { createSignalProofAgent } from "../src/lib/agent/pi-harness";

async function testAgentDirect() {
  console.log("=== Testing Pi Agent Harness Direct Execution ===");
  
  const agent = createSignalProofAgent({
    channelId: "-1001297305044",
    modelId: "DeepSeek-V4-Flash",
    thinkingLevel: "low",
    onEvent: (event) => {
      if (event.type === "tool_execution_start") {
        console.log(`\n[TOOL START] ${event.toolName}`);
      } else if (event.type === "tool_execution_end") {
        console.log(`[TOOL END] ${event.toolName}`);
      } else if (event.type === "message_update") {
        const sub = event.assistantMessageEvent;
        if (sub && sub.type === "text_delta") {
          process.stdout.write(sub.delta);
        } else if (sub && sub.type === "thinking_delta") {
          process.stdout.write(`[THOUGHT] ${sub.delta}`);
        }
      }
    }
  });

  console.log("\nSending prompt: 'Give me a brief audit summary of channel -1001297305044'...");
  await agent.prompt("Give me a brief audit summary of channel -1001297305044");
  await agent.waitForIdle();
  console.log("\n\n=== Direct Agent Test Completed Successfully ===");
}

testAgentDirect().catch(console.error);