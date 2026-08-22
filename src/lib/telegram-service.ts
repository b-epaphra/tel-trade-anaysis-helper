import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Instrument } from "dukascopy-node";
import { prisma } from "./prisma";

// Comprehensive alias mapping for Commodities, Indices, Crypto, and non-standard symbols
export const ALIAS_MAP: { [key: string]: string } = {
  // Commodities
  "GOLD": "xauusd",
  "XAU": "xauusd",
  "XAUUSD": "xauusd",
  "XAUEUR": "xaueur",
  "SILVER": "xagusd",
  "XAG": "xagusd",
  "XAGUSD": "xagusd",
  "XAGEUR": "xageur",
  "OIL": "lightcmdusd",
  "USOIL": "lightcmdusd",
  "WTI": "lightcmdusd",
  "CRUDE": "lightcmdusd",
  "XTIUSD": "lightcmdusd",
  "BRENT": "brentcmdusd",
  "UKOIL": "brentcmdusd",
  "XBRUSD": "brentcmdusd",
  "NATGAS": "gascmdusd",
  "GAS": "gascmdusd",

  // Indices
  "US30": "usa30idxusd",
  "DJ30": "usa30idxusd",
  "DJI": "usa30idxusd",
  "DOW": "usa30idxusd",
  "DOWJONES": "usa30idxusd",
  "NAS100": "usatechidxusd",
  "US100": "usatechidxusd",
  "USTEC": "usatechidxusd",
  "NQ": "usatechidxusd",
  "NASDAQ": "usatechidxusd",
  "NDX": "usatechidxusd",
  "SPX500": "usa500idxusd",
  "US500": "usa500idxusd",
  "SP500": "usa500idxusd",
  "SPX": "usa500idxusd",
  "GER30": "deuidxeur",
  "GER40": "deuidxeur",
  "DAX": "deuidxeur",
  "DAX40": "deuidxeur",
  "UK100": "gbridxgbp",
  "FTSE": "gbridxgbp",
  "FTSE100": "gbridxgbp",
  "JP225": "jpnidxjpy",
  "NIKKEI": "jpnidxjpy",
  "HK50": "hkgidxhkd",
  "HANGSENG": "hkgidxhkd",
  "EUSTX50": "eusidxeur",
  "STOXX50": "eusidxeur",

  // Crypto
  "BTC": "btcusd",
  "BITCOIN": "btcusd",
  "BTCUSD": "btcusd",
  "ETH": "ethusd",
  "ETHEREUM": "ethusd",
  "ETHUSD": "ethusd",
  "SOL": "solusd",
  "SOLANA": "solusd",
  "SOLUSD": "solusd",
  "XRP": "xrpusd",
  "RIPPLE": "xrpusd",
  "XRPUSD": "xrpusd",
  "LTC": "ltcusd",
  "LTCUSD": "ltcusd",
  "BNB": "bnbusd",
  "BNBUSD": "bnbusd",
  "DOGE": "dogusd",
  "DOGEUSD": "dogusd",
  "ADA": "adausd",
  "ADAUSD": "adausd",
};

/**
 * Dynamically resolves an asset name to Dukascopy's Instrument enum.
 * Supports all 1,400+ forex pairs, crosses, commodities, indices, and cryptos.
 */
export function resolveInstrument(asset: string): string | null {
  if (!asset) return null;
  const clean = asset.toUpperCase().replace(/[\/\-_ \.\u00a0]/g, "").trim();

  // 1. Direct alias match
  if (ALIAS_MAP[clean]) {
    return ALIAS_MAP[clean];
  }

  // 2. Direct Dukascopy Instrument lookup (handles all forex pairs like EURUSD, EURAUD, GBPJPY, NZDCAD, etc.)
  const lower = clean.toLowerCase();
  if ((Instrument as any)[lower]) {
    return (Instrument as any)[lower];
  }

  // 3. Fallback for 3-letter symbols (e.g. BTC -> btcusd)
  if (clean.length === 3) {
    const withUsd = `${lower}usd`;
    if ((Instrument as any)[withUsd]) {
      return (Instrument as any)[withUsd];
    }
  }

  return null;
}

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
  instr: string | null;
  claimedPips?: number | null;
  entryActual?: number | null;
  marketValueAtClaim?: string | number | null;
  actualResult?: string | null;
  outcomeTime?: string | null;
  durationMinutes?: number | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  fraudDetected?: boolean;
}

export interface IgnoredMessageItem {
  id: number;
  channelId: string;
  date: string;
  text: string;
  reason: string;
  replyToMsgId?: number | null;
}

export interface ExtractionResult {
  signals: ParsedSignalItem[];
  ignoredMessages: IgnoredMessageItem[];
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
 * Parses raw Telegram messages into structured signal items, claim replies,
 * and catalogs ignored/unparsed messages.
 */
export function extractSignalsAndClaims(
  channelId: string,
  rawMessages: Array<{ id: number; date: number; message?: string; replyTo?: any }>
): ExtractionResult {
  // Map Replies for Claims
  const claimsMap = new Map<number, { time: string; text: string; pips: number | null }>();
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
        const pipsMatch = (msg.message || "").match(/(\d+(?:\.\d+)?)\+?\s*pips/i);
        const claimedPips = pipsMatch ? parseFloat(pipsMatch[1]) : null;

        const msgTime = new Date(msg.date * 1000);
        const existing = claimsMap.get(replyToMsgId);

        if (existing) {
          const existingTime = new Date(existing.time);
          if (msgTime > existingTime) {
            claimsMap.set(replyToMsgId, {
              time: msgTime.toISOString(),
              text: existing.text + " | " + (msg.message || ""),
              pips: claimedPips || existing.pips,
            });
          } else {
            claimsMap.set(replyToMsgId, {
              time: existing.time,
              text: (msg.message || "") + " | " + existing.text,
              pips: existing.pips || claimedPips,
            });
          }
        } else {
          claimsMap.set(replyToMsgId, {
            time: msgTime.toISOString(),
            text: msg.message || "",
            pips: claimedPips,
          });
        }
      }
    }
  }

  const signals: ParsedSignalItem[] = [];
  const ignoredMessages: IgnoredMessageItem[] = [];

  for (const msg of rawMessages) {
    const rawText = msg.message || "";
    const text = rawText.replace(/\u00a0/g, " ").trim();

    let replyToMsgId: number | null = null;
    if (msg.replyTo) {
      if (typeof msg.replyTo.replyToMsgId === "number") {
        replyToMsgId = msg.replyTo.replyToMsgId;
      } else if (typeof msg.replyTo === "number") {
        replyToMsgId = msg.replyTo;
      }
    }

    // If it's a known claim reply (e.g. "TP hit"), skip adding to ignored list since it's an update
    if (replyToMsgId && (
      text.toLowerCase().includes("tp") ||
      text.toLowerCase().includes("profit") ||
      text.toLowerCase().includes("sl") ||
      text.toLowerCase().includes("hit")
    )) {
      continue;
    }

    // Try to match signal headers like "GOLD BUY AT 2030.5" or "EURUSD SELL AT 1.0850" or "US30 SELL AT 52960"
    const headerMatch = text.match(/(?:^|\n)\s*(?:[^\w\n]*\s*)?([A-Za-z0-9\/\-_]+)\s*(BUY|SELL)\s*AT\s*([\d\.]+)/i);

    if (!headerMatch) {
      // Check if message looks like a trade message to classify why it was ignored
      const hasAction = /\b(BUY|SELL|LONG|SHORT)\b/i.test(text);
      const hasSlOrTp = /\b(SL|TP|STOP LOSS|TAKE PROFIT)\b/i.test(text);

      if (hasAction || hasSlOrTp) {
        ignoredMessages.push({
          id: msg.id,
          channelId,
          date: new Date(msg.date * 1000).toISOString(),
          text: rawText,
          reason: hasAction
            ? "Missing entry format (expected 'ASSET BUY/SELL AT price')"
            : "Trade update or commentary without signal header",
          replyToMsgId,
        });
      }
      continue;
    }

    const asset = headerMatch[1].toUpperCase().replace(/[\/\-_]/g, "");
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

    if (!sl) {
      ignoredMessages.push({
        id: msg.id,
        channelId,
        date: new Date(msg.date * 1000).toISOString(),
        text: rawText,
        reason: "Missing Stop Loss (SL)",
        replyToMsgId,
      });
      continue;
    }

    if (tpList.length === 0) {
      ignoredMessages.push({
        id: msg.id,
        channelId,
        date: new Date(msg.date * 1000).toISOString(),
        text: rawText,
        reason: "Missing Take Profit (TP)",
        replyToMsgId,
      });
      continue;
    }

    // Dynamically resolve instrument for Dukascopy market data
    const instr = resolveInstrument(asset);

    const signalTime = new Date(msg.date * 1000);
    const claim = claimsMap.get(msg.id);

    signals.push({
      id: msg.id,
      channelId,
      asset,
      action,
      signalTime: signalTime.toISOString(),
      msg: rawText,
      entryClaimed: entry,
      sl,
      tps: tpList,
      providerClaimTime: claim ? claim.time : null,
      providerClaimMsg: claim ? claim.text : null,
      claimedPips: claim ? claim.pips : null,
      instr, // Can be null if unknown/unsupported, but signal is NEVER dropped!
    });
  }

  return { signals, ignoredMessages };
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
          claimedPips: sig.claimedPips,
          instr: sig.instr ? String(sig.instr) : null,
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
          claimedPips: sig.claimedPips,
          instr: sig.instr ? String(sig.instr) : null,
        },
      });
    }
  } catch (err) {
    console.error("Database cache upsert warning:", err);
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
      claimedPips: r.claimedPips,
      instr: r.instr || null,
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
