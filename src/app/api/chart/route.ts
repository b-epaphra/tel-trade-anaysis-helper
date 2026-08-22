import { NextResponse } from "next/server";
import { getHistoricalRates, Timeframe, Format } from "dukascopy-node";
import os from "os";
import path from "path";
import { verifyAdminAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const auth = verifyAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { instrument, signalTime, timeframe = "m1" } = await req.json();

    if (!instrument || !signalTime) {
      return NextResponse.json({ error: "Missing instrument or signalTime" }, { status: 400 });
    }

    const signalDate = new Date(signalTime);
    let selectedTimeframe = Timeframe.m1;
    let preBufferMs = 30 * 60 * 1000; // 30 minutes before signal for chart context
    let postDurationMs = 5 * 24 * 60 * 60 * 1000; // 5 days after

    if (timeframe === "m5") {
      selectedTimeframe = Timeframe.m5;
      preBufferMs = 2 * 60 * 60 * 1000;
      postDurationMs = 5 * 24 * 60 * 60 * 1000;
    } else if (timeframe === "m15") {
      selectedTimeframe = Timeframe.m15;
      preBufferMs = 4 * 60 * 60 * 1000;
      postDurationMs = 6 * 24 * 60 * 60 * 1000;
    } else if (timeframe === "h1") {
      selectedTimeframe = Timeframe.h1;
      preBufferMs = 24 * 60 * 60 * 1000;
      postDurationMs = 7 * 24 * 60 * 60 * 1000;
    }

    const fromDate = new Date(signalDate.getTime() - preBufferMs);
    const toDate = new Date(signalDate.getTime() + postDurationMs);

    const marketData = await getHistoricalRates({
      instrument: instrument,
      dates: {
        from: fromDate,
        to: toDate,
      },
      timeframe: selectedTimeframe,
      format: Format.json,
      useCache: true,
      cacheFolderPath: path.join(os.tmpdir(), '.dukascopy-cache'),
    });

    if (!marketData || marketData.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Map to lightweight-charts format (time must be UNIX timestamp in seconds for intraday)
    const formattedData = marketData.map((candle: any) => ({
      time: Math.floor(candle.timestamp / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
    });
  } catch (error: any) {
    console.error("Chart data fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
