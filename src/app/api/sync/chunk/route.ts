import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth";
import {
  fetchTelegramBatch,
  extractSignalsAndClaims,
  upsertSignalsToDb,
} from "@/lib/telegram-service";

export async function POST(req: Request) {
  try {
    const auth = verifyAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { channelId, offsetId = 0, limit = 100, cutoffTimestamp } = await req.json();

    if (!channelId) {
      return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
    }

    const batch = await fetchTelegramBatch(channelId, {
      limit,
      offsetId,
      cutoffTimestamp,
    });

    const parsedSignals = extractSignalsAndClaims(channelId, batch.messages);

    // Save/update signals in database
    if (parsedSignals.length > 0) {
      await upsertSignalsToDb(parsedSignals);
    }

    return NextResponse.json({
      success: true,
      data: {
        signals: parsedSignals,
        messagesCount: batch.messages.length,
        signalsCount: parsedSignals.length,
        lastOffsetId: batch.lastOffsetId,
        hasMore: batch.hasMore,
      },
    });
  } catch (error: any) {
    console.error("Sync chunk error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
