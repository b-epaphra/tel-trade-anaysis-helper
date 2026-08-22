import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const API_ID = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
const API_HASH = process.env.TELEGRAM_API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION || "";
const CHANNEL_ID = process.argv[2] || process.env.TELEGRAM_CHANNEL_ID || "-1001297305044";

async function run() {
  if (!API_ID || !API_HASH || !SESSION_STRING) {
    console.error("Missing Telegram credentials in .env");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(SESSION_STRING), API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.connect();
  console.log("Connected to Telegram successfully.");

  try {
    const entity = await client.getEntity(CHANNEL_ID);
    console.log(`Fetching messages for channel/chat: ${CHANNEL_ID}...`);

    const twoDaysAgo = Math.floor(Date.now() / 1000) - (2 * 86400);
    const messages: any[] = [];

    // Fetch messages iteratively
    for await (const msg of client.iterMessages(entity, { limit: 100 })) {
      if (msg instanceof Api.Message) {
        if (msg.date < twoDaysAgo) {
          // Reached older than 2 days
          break;
        }
        messages.push({
          id: msg.id,
          date: new Date(msg.date * 1000).toISOString(),
          text: msg.message || "[Media / Non-text message]",
          views: msg.views,
          forwards: msg.forwards,
          replyToMsgId: msg.replyTo instanceof Api.MessageReplyHeader ? msg.replyTo.replyToMsgId : undefined,
        });
      }
    }

    console.log(`\n=== Found ${messages.length} messages in the last 2 days ===\n`);
    for (const m of messages) {
      console.log(`----------------------------------------`);
      console.log(`ID: ${m.id} | Date: ${m.date} | Views: ${m.views ?? 0} | ReplyTo: ${m.replyToMsgId ?? 'None'}`);
      console.log(`Message:\n${m.text}`);
    }
  } catch (err: any) {
    console.error("Error fetching messages:", err);
  } finally {
    await client.disconnect();
  }
}

run();
