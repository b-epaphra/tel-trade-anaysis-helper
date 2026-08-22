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

    // If already finalized (WIN, LOSS, DATA_GAP, UNSUPPORTED_DATA, MANUAL_WIN) and not forced, return cached result
    const isFinalOutcome = signal.actualResult === "WIN" || signal.actualResult === "LOSS" || signal.actualResult === "DATA_GAP" || signal.actualResult === "UNSUPPORTED_DATA" || signal.actualResult === "MANUAL_WIN";
    if (isFinalOutcome && !signal.forceResimulate) {
      return NextResponse.json({
        success: true,
        data: signal,
        cached: true,
      });
    }

    // If no market instrument is available for backtesting, mark as UNSUPPORTED_DATA
    if (!signal.instr) {
      const unsupportedOutcome = {
        ...signal,
        entryActual: null,
        marketValueAtClaim: "N/A",
        actualResult: "UNSUPPORTED_DATA",
        outcomeTime: null,
        durationMinutes: null,
        maxPrice: null,
        minPrice: null,
        fraudDetected: false,
      };

      if (signal.channelId && signal.id) {
        updateSignalSimulationResultInDb(signal.channelId, signal.id, {
          actualResult: "UNSUPPORTED_DATA",
          fraudDetected: false,
        }).catch((e) => console.warn("Failed to persist unsupported result:", e));
      }

      return NextResponse.json({
        success: true,
        data: unsupportedOutcome,
      });
    }

    const signalTime = new Date(signal.signalTime);
    const isFiveDaysPassed = (Date.now() - signalTime.getTime()) >= (5 * 24 * 60 * 60 * 1000);
    let marketResult = isFiveDaysPassed ? "EXPIRED" : "ACTIVE";
    let fraudDetected = false;
    let marketPriceAtClaim: string | number = "N/A";
    let marketValueActual: number | null = null;
    let outcomeTime: string | null = null;
    let maxPrice: number | null = null;
    let minPrice: number | null = null;
    let durationMinutes: number | null = null;

    try {
      const marketData = await getHistoricalRates({
        instrument: signal.instr,
        dates: {
          from: signalTime,
          to: new Date(signalTime.getTime() + 5 * 24 * 60 * 60 * 1000), // 5-day evaluation window
        },
        timeframe: Timeframe.m1,
        format: Format.json,
        useCache: true,
        cacheFolderPath: path.join(os.tmpdir(), '.dukascopy-cache'),
      });

      if (marketData && marketData.length > 0) {
        const actualEntry = marketData[0].open;
        marketValueActual = actualEntry;

        const firstCandleTime = marketData[0].timestamp;
        const timeDiffMinutes = (firstCandleTime - signalTime.getTime()) / (60 * 1000);
        const entryClaimed = Number(signal.entryClaimed || signal.entry);
        const deviation = entryClaimed ? Math.abs(entryClaimed - actualEntry) / actualEntry : 0;

        // If the first available tick is more than 60 minutes after signal posted (e.g. datafeed gap / closed market)
        // or if price gapped heavily (>5% deviation), flag as DATA_GAP to prevent false-positive evaluation
        if (timeDiffMinutes > 60 || deviation > 0.05) {
          marketResult = "DATA_GAP";
        } else {
          let highest = -Infinity;
          let lowest = Infinity;

          const claimTimeMs = signal.providerClaimTime ? new Date(signal.providerClaimTime).getTime() : null;
          let claimProcessed = false;
          let manualWinCandidate = false;
          let claimDurationMinutes: number | null = null;

          for (let i = 0; i < marketData.length; i++) {
            const candle = marketData[i];
            if (candle.high > highest) highest = candle.high;
            if (candle.low < lowest) lowest = candle.low;

            // Process claim snapshot when we reach claimTimeMs
            if (claimTimeMs && !claimProcessed && candle.timestamp >= claimTimeMs) {
              claimProcessed = true;
              marketPriceAtClaim = candle.close;
              claimDurationMinutes = i + 1;

              // Evaluate MFE (Maximum Favorable Excursion) before/at this claim time
              let isInProfit = false;
              if (signal.action === "SELL" && lowest < actualEntry) isInProfit = true;
              if (signal.action === "BUY" && highest > actualEntry) isInProfit = true;
              
              if (isInProfit) {
                manualWinCandidate = true;
                // DO NOT break here. We let the simulation run to see if it hits a hard TP.
              } else {
                fraudDetected = true; // Claimed profit but was in loss the entire time
              }
            }

            if (signal.action === "SELL") {
              if (candle.high >= signal.sl) {
                if (manualWinCandidate) {
                  marketResult = "MANUAL_WIN";
                  outcomeTime = new Date(claimTimeMs!).toISOString();
                  durationMinutes = claimDurationMinutes;
                } else {
                  marketResult = "LOSS";
                  outcomeTime = new Date(candle.timestamp).toISOString();
                  durationMinutes = i + 1;
                  // If SL is hit before claim time, the future claim is fraudulent
                  if (claimTimeMs && !claimProcessed) fraudDetected = true;
                }
                break;
              }
              // Check ALL TPs
              if (signal.tps.some((tp: number) => candle.low <= tp)) {
                marketResult = "WIN";
                outcomeTime = new Date(candle.timestamp).toISOString();
                durationMinutes = i + 1;
                break;
              }
            } else {
              if (candle.low <= signal.sl) {
                if (manualWinCandidate) {
                  marketResult = "MANUAL_WIN";
                  outcomeTime = new Date(claimTimeMs!).toISOString();
                  durationMinutes = claimDurationMinutes;
                } else {
                  marketResult = "LOSS";
                  outcomeTime = new Date(candle.timestamp).toISOString();
                  durationMinutes = i + 1;
                  if (claimTimeMs && !claimProcessed) fraudDetected = true;
                }
                break;
              }
              // Check ALL TPs
              if (signal.tps.some((tp: number) => candle.high >= tp)) {
                marketResult = "WIN";
                outcomeTime = new Date(candle.timestamp).toISOString();
                durationMinutes = i + 1;
                break;
              }
            }
          }

          // If 5 days elapsed without hitting SL or TP, check if there was a manual win claim
          if (marketResult === "ACTIVE" || marketResult === "EXPIRED") {
            if (manualWinCandidate) {
              marketResult = "MANUAL_WIN";
              outcomeTime = new Date(claimTimeMs!).toISOString();
              durationMinutes = claimDurationMinutes;
            }
          }

          maxPrice = highest === -Infinity ? null : highest;
          minPrice = lowest === Infinity ? null : lowest;

          if (signal.providerClaimTime && marketPriceAtClaim === "N/A") {
             // In case claim time happened after the 5-day window, find nearest tick
             const candleAtClaim = marketData.find((c) => Math.abs(c.timestamp - claimTimeMs!) < 60000);
             if (candleAtClaim) marketPriceAtClaim = candleAtClaim.close;
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
