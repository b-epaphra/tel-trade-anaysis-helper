import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import * as dotenv from "dotenv";
import * as path from "path";
import { extractSignalsAndClaims } from "../src/lib/telegram-service";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const API_ID = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
const API_HASH = process.env.TELEGRAM_API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION || "";
const CHANNEL_ID = process.argv[2] || process.env.TELEGRAM_CHANNEL_ID || "-1001297305044";
const DAYS = parseInt(process.argv[3] || "180", 10);

async function run() {
  if (!API_ID || !API_HASH || !SESSION_STRING) {
    console.error("Missing Telegram credentials in .env");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(SESSION_STRING), API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.connect();
  console.log(`Connected to Telegram. Channel: ${CHANNEL_ID}, Days: ${DAYS}`);

  try {
    const entity = await client.getEntity(CHANNEL_ID);
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const cutoffTimestamp = nowTimestamp - DAYS * 86400;
    const cutoffDate = new Date(cutoffTimestamp * 1000);
    console.log(`Fetching messages back to: ${cutoffDate.toISOString()}...`);

    const rawMessages: Array<{ id: number; date: number; message: string; replyTo: any }> = [];
    let count = 0;

    for await (const msg of client.iterMessages(entity, {})) {
      if (msg instanceof Api.Message) {
        if (msg.date < cutoffTimestamp) {
          break;
        }
        rawMessages.push({
          id: msg.id,
          date: msg.date,
          message: msg.message || "",
          replyTo: msg.replyTo,
        });
        count++;
        if (count % 250 === 0) {
          console.log(`Fetched ${count} messages so far... (current message date: ${new Date(msg.date * 1000).toISOString()})`);
        }
      }
    }

    console.log(`\nFetch complete! Total raw messages fetched: ${rawMessages.length}`);

    const { signals, ignoredMessages } = extractSignalsAndClaims(CHANNEL_ID, rawMessages);

    console.log(`\n================ SUMMARY (LAST ${DAYS} DAYS) ================`);
    console.log(`Total Telegram Messages: ${rawMessages.length}`);
    console.log(`Parsed Signals: ${signals.length}`);
    console.log(`Ignored / Non-signal Messages: ${ignoredMessages.length}`);
    
    // Breakdown by asset
    const assetCounts: Record<string, number> = {};
    for (const s of signals) {
      assetCounts[s.asset] = (assetCounts[s.asset] || 0) + 1;
    }
    console.log("\nSignals Breakdown by Asset:");
    console.table(assetCounts);

  } catch (err: any) {
    console.error("Error during fetch:", err);
  } finally {
    await client.disconnect();
    console.log("Disconnected from Telegram.");
  }
}

run();
