import { NextResponse } from "next/server";
import { getHistoricalRates, Timeframe, Format } from "dukascopy-node";
import os from "os";
import path from "path";
import { verifyAdminAuth } from "@/lib/auth";
import { updateSignalSimulationResultInDb } from "@/lib/telegram-service";

export async function POST(req: Request) {
  try {
    const auth = verifyAdminAuth(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const signal = await req.json();

    // If already simulated and valid in cache (and not forced to re-simulate), return cached result
    if (signal.actualResult && signal.actualResult !== "PENDING" && signal.actualResult !== "ERROR" && !signal.forceResimulate) {
      return NextResponse.json({
        success: true,
        data: signal,
        cached: true,
      });
    }

    let marketResult = "EXPIRED";
    let fraudDetected = false;
    let marketPriceAtClaim: string | number = "N/A";
    let marketValueActual: number | null = null;
    let outcomeTime: string | null = null;
    let maxPrice: number | null = null;
    let minPrice: number | null = null;
    let durationMinutes: number | null = null;

    try {
      const signalTime = new Date(signal.signalTime);
      const marketData = await getHistoricalRates({
        instrument: signal.instr,
        dates: {
          from: signalTime,
          to: new Date(signalTime.getTime() + 24 * 60 * 60 * 1000),
        },
        timeframe: Timeframe.m1,
        format: Format.json,
        useCache: true,
        cacheFolderPath: path.join(os.tmpdir(), '.dukascopy-cache'),
      });

      if (marketData && marketData.length > 0) {
        const actualEntry = marketData[0].open;
        marketValueActual = actualEntry;

        let highest = -Infinity;
        let lowest = Infinity;

        for (let i = 0; i < marketData.length; i++) {
          const candle = marketData[i];
          if (candle.high > highest) highest = candle.high;
          if (candle.low < lowest) lowest = candle.low;

          if (signal.action === "SELL") {
            if (candle.high >= signal.sl) {
              marketResult = "LOSS";
              outcomeTime = new Date(candle.timestamp).toISOString();
              durationMinutes = i + 1;
              break;
            }
            if (candle.low <= signal.tps[0]) {
              marketResult = "WIN";
              outcomeTime = new Date(candle.timestamp).toISOString();
              durationMinutes = i + 1;
              break;
            }
          } else {
            if (candle.low <= signal.sl) {
              marketResult = "LOSS";
              outcomeTime = new Date(candle.timestamp).toISOString();
              durationMinutes = i + 1;
              break;
            }
            if (candle.high >= signal.tps[0]) {
              marketResult = "WIN";
              outcomeTime = new Date(candle.timestamp).toISOString();
              durationMinutes = i + 1;
              break;
            }
          }
        }

        maxPrice = highest === -Infinity ? null : highest;
        minPrice = lowest === Infinity ? null : lowest;

        if (signal.providerClaimTime) {
          const claimTimeMs = new Date(signal.providerClaimTime).getTime();
          const candleAtClaim = marketData.find((c) => Math.abs(c.timestamp - claimTimeMs) < 60000);
          if (candleAtClaim) marketPriceAtClaim = candleAtClaim.close;

          if (marketResult === "LOSS") {
            fraudDetected = true;
          }
        }
      }
    } catch (err) {
      console.error(`Error simulating ${signal.asset}:`, err);
      marketResult = "ERROR";
    }

    const outcome = {
      ...signal,
      entryActual: marketValueActual,
      marketValueAtClaim: marketPriceAtClaim,
      actualResult: marketResult,
      outcomeTime,
      durationMinutes,
      maxPrice,
      minPrice,
      fraudDetected,
    };

    // Cache the simulation outcome into Database asynchronously
    if (signal.channelId && signal.id) {
      updateSignalSimulationResultInDb(signal.channelId, signal.id, {
        entryActual: marketValueActual,
        marketValueAtClaim: marketPriceAtClaim,
        actualResult: marketResult,
        outcomeTime,
        durationMinutes,
        maxPrice,
        minPrice,
        fraudDetected,
      }).catch((e) => console.warn("Failed to persist simulation result:", e));
    }

    return NextResponse.json({
      success: true,
      data: outcome,
    });
  } catch (error: any) {
    console.error("Simulation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
