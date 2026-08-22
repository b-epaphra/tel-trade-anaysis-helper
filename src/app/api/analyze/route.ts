import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth";
import {
  fetchTelegramBatch,
  extractSignalsAndClaims,
  upsertSignalsToDb,
  getCachedSignalsFromDb,
  ParsedSignalItem,
  IgnoredMessageItem,
} from "@/lib/telegram-service";

export async function POST(req: Request) {
  try {
    const auth = verifyAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { channelId, days = 30, mode = "normal" } = await req.json();
    if (!channelId || !days) {
      return NextResponse.json({ error: "Missing channelId or days" }, { status: 400 });
    }

    const requestedDays = parseInt(days, 10);
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const cutoffTimestamp = nowTimestamp - requestedDays * 86400;
    const cutoffDate = new Date(cutoffTimestamp * 1000);

    // Hard processing mode for small ranges can be executed directly;
    // For large ranges, frontend will use /api/sync/chunk for client-side chunking.
    if (mode === "hard") {
      let rawMessages: Array<{ id: number; date: number; message: string; replyTo: any }> = [];
      let offsetId = 0;
      let iterations = 0;
      const MAX_DIRECT_ITERATIONS = 8; // prevent serverless timeout

      while (iterations < MAX_DIRECT_ITERATIONS) {
        iterations++;
        const batch = await fetchTelegramBatch(channelId, {
          limit: 100,
          offsetId,
          cutoffTimestamp,
        });

        rawMessages.push(...batch.messages);
        offsetId = batch.lastOffsetId;
        if (!batch.hasMore) break;
      }

      const { signals, ignoredMessages } = extractSignalsAndClaims(channelId, rawMessages);
      if (signals.length > 0) {
        await upsertSignalsToDb(signals);
      }

      return NextResponse.json({
        success: true,
        data: signals,
        ignoredMessages,
        mode: "hard",
        requiresFurtherChunking: iterations >= MAX_DIRECT_ITERATIONS,
        lastOffsetId: offsetId,
      });
    }

    // NORMAL MODE:
    // 1. Fetch fresh near-past (last 30 days or requestedDays if < 30) from Telegram
    const recentDays = Math.min(requestedDays, 30);
    const recentCutoffTimestamp = nowTimestamp - recentDays * 86400;
    const recentCutoffDate = new Date(recentCutoffTimestamp * 1000);

    let recentRawMessages: Array<{ id: number; date: number; message: string; replyTo: any }> = [];
    let offsetId = 0;
    let iterations = 0;

    while (iterations < 5) {
      iterations++;
      const batch = await fetchTelegramBatch(channelId, {
        limit: 100,
        offsetId,
        cutoffTimestamp: recentCutoffTimestamp,
      });

      recentRawMessages.push(...batch.messages);
      offsetId = batch.lastOffsetId;
      if (!batch.hasMore) break;
    }

    const { signals: recentSignals, ignoredMessages: recentIgnored } = extractSignalsAndClaims(
      channelId,
      recentRawMessages
    );

    if (recentSignals.length > 0) {
      await upsertSignalsToDb(recentSignals);
    }

    let allSignals: ParsedSignalItem[] = [...recentSignals];
    let allIgnored: IgnoredMessageItem[] = [...recentIgnored];

    // 2. If user requested > 30 days, load older signals (> 30 days) from Database Cache
    if (requestedDays > 30) {
      const cachedOlderSignals = await getCachedSignalsFromDb(
        channelId,
        cutoffDate,
        recentCutoffDate
      );

      if (cachedOlderSignals.length > 0) {
        allSignals.push(...cachedOlderSignals);
      } else {
        // DB does not have older records yet: Backfill from Telegram
        let olderRawMessages: Array<{ id: number; date: number; message: string; replyTo: any }> = [];
        let olderIterations = 0;

        while (olderIterations < 6) {
          olderIterations++;
          const batch = await fetchTelegramBatch(channelId, {
            limit: 100,
            offsetId,
            cutoffTimestamp,
          });

          olderRawMessages.push(...batch.messages);
          offsetId = batch.lastOffsetId;
          if (!batch.hasMore) break;
        }

        const { signals: olderSignals, ignoredMessages: olderIgnored } = extractSignalsAndClaims(
          channelId,
          olderRawMessages
        );
        if (olderSignals.length > 0) {
          await upsertSignalsToDb(olderSignals);
          allSignals.push(...olderSignals);
        }
        allIgnored.push(...olderIgnored);
      }
    }

    // Deduplicate by message ID and sort by signalTime descending
    const uniqueMap = new Map<number, ParsedSignalItem>();
    for (const sig of allSignals) {
      if (!uniqueMap.has(sig.id)) {
        uniqueMap.set(sig.id, sig);
      }
    }

    const sortedSignals = Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.signalTime).getTime() - new Date(a.signalTime).getTime()
    );

    // Deduplicate ignored messages
    const uniqueIgnoredMap = new Map<number, IgnoredMessageItem>();
    for (const item of allIgnored) {
      if (!uniqueIgnoredMap.has(item.id)) {
        uniqueIgnoredMap.set(item.id, item);
      }
    }
    const sortedIgnored = Array.from(uniqueIgnoredMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({
      success: true,
      data: sortedSignals,
      ignoredMessages: sortedIgnored,
      mode: "normal",
      cachedOldCount: requestedDays > 30 ? allSignals.length - recentSignals.length : 0,
      recentCount: recentSignals.length,
      ignoredCount: sortedIgnored.length,
    });
  } catch (error: any) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
