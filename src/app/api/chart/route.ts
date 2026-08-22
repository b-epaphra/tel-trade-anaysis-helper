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

    const { instrument, signalTime } = await req.json();

    if (!instrument || !signalTime) {
      return NextResponse.json({ error: "Missing instrument or signalTime" }, { status: 400 });
    }

    const startTime = new Date(signalTime);
    // Fetch 24 hours of 1-minute candles
    const marketData = await getHistoricalRates({
      instrument: instrument,
      dates: {
        from: startTime,
        to: new Date(startTime.getTime() + 24 * 60 * 60 * 1000),
      },
      timeframe: Timeframe.m1,
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
