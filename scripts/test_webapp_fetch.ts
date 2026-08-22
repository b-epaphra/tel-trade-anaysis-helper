import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Import the web app's exact logic from telegram-service
import {
  fetchTelegramBatch,
  extractSignalsAndClaims,
} from "../src/lib/telegram-service";

async function testWebAppFetch() {
  const channelId = process.argv[2] || process.env.TELEGRAM_CHANNEL_ID || "-1001297305044";
  const days = parseInt(process.argv[3] || "2", 10);

  const nowTimestamp = Math.floor(Date.now() / 1000);
  const cutoffTimestamp = nowTimestamp - days * 86400;
  const cutoffDate = new Date(cutoffTimestamp * 1000);

  console.log("==================================================");
  console.log(`Testing Web App Logic with Channel: ${channelId}`);
  console.log(`Time window: Last ${days} days (Since: ${cutoffDate.toISOString()})`);
  console.log("==================================================\n");

  const rawMessages: Array<{ id: number; date: number; message: string; replyTo: any }> = [];
  let offsetId = 0;
  let batchIndex = 0;
  let hasMore = true;

  console.log("--> Step 1: Fetching batches using 'fetchTelegramBatch' (Web App Service)...");

  while (hasMore) {
    batchIndex++;
    console.log(`[Batch ${batchIndex}] Fetching with offsetId = ${offsetId}...`);

    const batch = await fetchTelegramBatch(channelId, {
      limit: 100,
      offsetId,
      cutoffTimestamp,
    });

    rawMessages.push(...batch.messages);
    offsetId = batch.lastOffsetId;
    hasMore = batch.hasMore;

    console.log(`  -> Retrieved ${batch.messages.length} messages. (Total accumulated: ${rawMessages.length})`);
    if (!hasMore) break;
  }

  console.log(`\n--> Total raw messages fetched in ${days} days: ${rawMessages.length}`);

  console.log("\n--> Step 2: Extracting signals and claims using 'extractSignalsAndClaims'...");
  const { signals, ignoredMessages } = extractSignalsAndClaims(channelId, rawMessages);

  console.log(`--> Found ${signals.length} parsed trading signals from the fetched messages.`);
  console.log(`--> Found ${ignoredMessages.length} ignored / unparsed potential trade messages.\n`);

  console.log("================ EXTRACTED SIGNALS ================");
  for (const sig of signals) {
    console.log(`Signal Message #${sig.id} | Asset: ${sig.asset} | Action: ${sig.action} | Instr: ${sig.instr || 'UNSUPPORTED'} | Time: ${sig.signalTime}`);
    console.log(`  Entry Claimed: ${sig.entryClaimed}`);
    console.log(`  Stop Loss: ${sig.sl}`);
    console.log(`  Take Profits: ${sig.tps.join(", ")}`);
    if (sig.providerClaimMsg) {
      console.log(`  Claim Found: "${sig.providerClaimMsg}" at ${sig.providerClaimTime}`);
    } else {
      console.log(`  Claim Found: None`);
    }
    console.log("--------------------------------------------------");
  }

  if (ignoredMessages.length > 0) {
    console.log("\n================ IGNORED / UNPARSED MESSAGES ================");
    for (const item of ignoredMessages) {
      console.log(`Message #${item.id} | Date: ${item.date} | Reason: ${item.reason}`);
      console.log(`Text: ${item.text.trim()}`);
      console.log("--------------------------------------------------");
    }
  }

  console.log("\n[Test Complete] Successfully verified dynamic resolution & ignored message logging.");
}

testWebAppFetch().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
