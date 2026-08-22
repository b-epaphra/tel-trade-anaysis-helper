import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Instrument } from "dukascopy-node";
import { prisma } from "./prisma";

export const INSTRUMENT_MAP: { [key: string]: Instrument } = {
  "EURJPY": Instrument.eurjpy,
  "GBPJPY": Instrument.gbpjpy,
  "XTIUSD": Instrument.lightcmdusd,
  "XAGUSD": Instrument.xagusd,
  "XAGEUR": Instrument.xageur,
  "GOLD": Instrument.xauusd,
  "XAUUSD": Instrument.xauusd,
  "EURUSD": Instrument.eurusd,
  "GBPUSD": Instrument.gbpusd,
  "USDJPY": Instrument.usdjpy,
  "USDCAD": Instrument.usdcad,
  "AUDUSD": Instrument.audusd,
  "NZDUSD": Instrument.nzdusd,
  "USDCHF": Instrument.usdchf,
  "BTCUSD": Instrument.btcusd,
  "ETHUSD": Instrument.ethusd,
};

export interface ParsedSignalItem {
  id: number;
  channelId: string;
  asset: string;
  action: string;
  signalTime: string;
  msg: string;
  entryClaimed: number;
  sl: number;
  tps: number[];
  providerClaimTime: string | null;
  providerClaimMsg: string | null;
  instr: string;
  entryActual?: number | null;
  marketValueAtClaim?: string | number | null;
  actualResult?: string | null;
  outcomeTime?: string | null;
  durationMinutes?: number | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  fraudDetected?: boolean;
}

export function getTelegramClient() {
  const API_ID = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
  const API_HASH = process.env.TELEGRAM_API_HASH || "";
  const SESSION_STRING = process.env.TELEGRAM_SESSION || "";

  if (!SESSION_STRING) {
    throw new Error("Missing TELEGRAM_SESSION in environment variables");
  }

  const stringSession = new StringSession(SESSION_STRING);
  return new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
  });
}

/**
 * Parses raw Telegram messages into structured signal items and claim replies.
 */
export function extractSignalsAndClaims(
  channelId: string,
  rawMessages: Array<{ id: number; date: number; message?: string; replyTo?: any }>
): ParsedSignalItem[] {
  // Map Replies for Claims
  const claimsMap = new Map<number, { time: string; text: string }>();
  for (const msg of rawMessages) {
    let replyToMsgId: number | undefined = undefined;
    if (msg.replyTo) {
      if (typeof msg.replyTo.replyToMsgId === "number") {
        replyToMsgId = msg.replyTo.replyToMsgId;
      } else if (typeof msg.replyTo === "number") {
        replyToMsgId = msg.replyTo;
      }
    }

    if (replyToMsgId) {
      const text = (msg.message || "").toLowerCase();
      if (
        text.includes("tp") ||
        text.includes("hit") ||
        text.includes("boom") ||
        text.includes("profit") ||
        text.includes("sl") ||
        text.includes("closed")
      ) {
        claimsMap.set(replyToMsgId, {
          time: new Date(msg.date * 1000).toISOString(),
          text: msg.message || "",
        });
      }
    }
  }

  const results: ParsedSignalItem[] = [];

  for (const msg of rawMessages) {
    const text = msg.message || "";
    // Matches formats like: GOLD BUY AT 2030.5 or EURUSD SELL AT 1.0850
    const headerMatch = text.match(/^([A-Za-z0-9]+)\s*(BUY|SELL)\s*AT\s*([\d\.]+)/i);
    if (!headerMatch) continue;

    const asset = headerMatch[1].toUpperCase();
    const action = headerMatch[2].toUpperCase();
    const entry = parseFloat(headerMatch[3]);

    const slMatch = text.match(/SL[_:\-\s]*([\d\.]+)/i);
    const sl = slMatch ? parseFloat(slMatch[1]) : 0;

    const tpRegex = /TP[_:\-\s]*([\d\.]+)/gi;
    const tpList: number[] = [];
    let match;
    while ((match = tpRegex.exec(text)) !== null) {
      tpList.push(parseFloat(match[1]));
    }

    const instrKey = asset === "GOLD" ? "GOLD" : asset;
    const instr = INSTRUMENT_MAP[instrKey];
    if (!instr || !sl || tpList.length === 0) continue;

    const signalTime = new Date(msg.date * 1000);
    const claim = claimsMap.get(msg.id);

    results.push({
      id: msg.id,
      channelId,
      asset,
      action,
      signalTime: signalTime.toISOString(),
      msg: text,
      entryClaimed: entry,
      sl,
      tps: tpList,
      providerClaimTime: claim ? claim.time : null,
      providerClaimMsg: claim ? claim.text : null,
      instr,
    });
  }

  return results;
}

/**
 * Fetch a batch of messages from Telegram directly
 */
export async function fetchTelegramBatch(
  channelId: string,
  options: {
    limit?: number;
    offsetId?: number;
    cutoffTimestamp?: number;
  }
) {
  const client = getTelegramClient();
  await client.connect();

  try {
    const entity = await client.getEntity(channelId);
    const limit = options.limit || 100;
    const offsetId = options.offsetId || 0;

    const messages = await client.getMessages(entity, { limit, offsetId });
    if (!messages || messages.length === 0) {
      return { messages: [], lastOffsetId: offsetId, hasMore: false };
    }

    const rawMessages: Array<{ id: number; date: number; message: string; replyTo: any }> = [];
    let stop = false;
    let newOffsetId = offsetId;

    for (const msg of messages) {
      if (!(msg instanceof Api.Message)) continue;
      newOffsetId = msg.id;

      if (options.cutoffTimestamp && msg.date < options.cutoffTimestamp) {
        stop = true;
        break;
      }

      rawMessages.push({
        id: msg.id,
        date: msg.date,
        message: msg.message || "",
        replyTo: msg.replyTo,
      });
    }

    return {
      messages: rawMessages,
      lastOffsetId: newOffsetId,
      hasMore: !stop && messages.length >= limit,
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Persist parsed signals into database cache (Upsert)
 */
export async function upsertSignalsToDb(signals: ParsedSignalItem[]) {
  if (signals.length === 0) return;

  // Ensure channel exists
  const channelId = signals[0].channelId;
  try {
    await prisma.channel.upsert({
      where: { id: channelId },
      update: { lastSyncedAt: new Date() },
      create: { id: channelId, lastSyncedAt: new Date() },
    });

    for (const sig of signals) {
      await prisma.cachedSignal.upsert({
        where: {
          channelId_messageId: {
            channelId: sig.channelId,
            messageId: sig.id,
          },
        },
        update: {
          asset: sig.asset,
          action: sig.action,
          signalTime: new Date(sig.signalTime),
          entryClaimed: sig.entryClaimed,
          sl: sig.sl,
          tps: sig.tps,
          msg: sig.msg,
          providerClaimTime: sig.providerClaimTime ? new Date(sig.providerClaimTime) : null,
          providerClaimMsg: sig.providerClaimMsg,
          instr: String(sig.instr),
        },
        create: {
          channelId: sig.channelId,
          messageId: sig.id,
          asset: sig.asset,
          action: sig.action,
          signalTime: new Date(sig.signalTime),
          entryClaimed: sig.entryClaimed,
          sl: sig.sl,
          tps: sig.tps,
          msg: sig.msg,
          providerClaimTime: sig.providerClaimTime ? new Date(sig.providerClaimTime) : null,
          providerClaimMsg: sig.providerClaimMsg,
          instr: String(sig.instr),
        },
      });
    }
  } catch (err) {
    console.error("Database cache upsert warning:", err);
    // Non-fatal if DB not yet connected or migrating
  }
}

/**
 * Update backtest simulation outcome in DB cache
 */
export async function updateSignalSimulationResultInDb(
  channelId: string,
  messageId: number,
  simulationData: {
    entryActual?: number | null;
    marketValueAtClaim?: string | number | null;
    actualResult?: string | null;
    outcomeTime?: string | null;
    durationMinutes?: number | null;
    maxPrice?: number | null;
    minPrice?: number | null;
    fraudDetected?: boolean;
  }
) {
  try {
    await prisma.cachedSignal.updateMany({
      where: { channelId, messageId },
      data: {
        entryActual: simulationData.entryActual ?? null,
        marketValueAtClaim: simulationData.marketValueAtClaim ? String(simulationData.marketValueAtClaim) : null,
        actualResult: simulationData.actualResult ?? null,
        outcomeTime: simulationData.outcomeTime ? new Date(simulationData.outcomeTime) : null,
        durationMinutes: simulationData.durationMinutes ?? null,
        maxPrice: simulationData.maxPrice ?? null,
        minPrice: simulationData.minPrice ?? null,
        fraudDetected: simulationData.fraudDetected ?? false,
        simulatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Database simulation update warning:", err);
  }
}

/**
 * Fetch cached signals from Database for a given timeframe
 */
export async function getCachedSignalsFromDb(
  channelId: string,
  fromTime?: Date,
  toTime?: Date
): Promise<ParsedSignalItem[]> {
  try {
    const whereClause: any = { channelId };
    if (fromTime || toTime) {
      whereClause.signalTime = {};
      if (fromTime) whereClause.signalTime.gte = fromTime;
      if (toTime) whereClause.signalTime.lte = toTime;
    }

    const records = await prisma.cachedSignal.findMany({
      where: whereClause,
      orderBy: { signalTime: "desc" },
    });

    return records.map((r) => ({
      id: r.messageId,
      channelId: r.channelId,
      asset: r.asset,
      action: r.action,
      signalTime: r.signalTime.toISOString(),
      msg: r.msg,
      entryClaimed: r.entryClaimed,
      sl: r.sl,
      tps: r.tps,
      providerClaimTime: r.providerClaimTime ? r.providerClaimTime.toISOString() : null,
      providerClaimMsg: r.providerClaimMsg,
      instr: r.instr || "",
      entryActual: r.entryActual,
      marketValueAtClaim: r.marketValueAtClaim,
      actualResult: r.actualResult,
      outcomeTime: r.outcomeTime ? r.outcomeTime.toISOString() : null,
      durationMinutes: r.durationMinutes,
      maxPrice: r.maxPrice,
      minPrice: r.minPrice,
      fraudDetected: r.fraudDetected,
    }));
  } catch (err) {
    console.warn("Could not retrieve cached signals from DB:", err);
    return [];
  }
}
