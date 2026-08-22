"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CrosshairMode,
  LineStyle,
  ColorType,
  CandlestickSeries,
  createSeriesMarkers,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import {
  Maximize2,
  Minimize2,
  Camera,
  Crosshair,
  Eye,
  EyeOff,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from "lucide-react";

interface TradeChartProps {
  trade: any;
}

type TimeframeOption = "m1" | "m5" | "m15" | "h1";

interface HoverCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pipsFromEntry: number | null;
}

export default function TradeChart({ trade }: TradeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const seriesInstanceRef = useRef<ISeriesApi<"Candlestick", any> | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  // State management
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeOption>("m1");
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoverData, setHoverData] = useState<HoverCandle | null>(null);

  // Overlay visibility toggles
  const [showEntryLine, setShowEntryLine] = useState(true);
  const [showSlLine, setShowSlLine] = useState(true);
  const [showTpLine, setShowTpLine] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);

  // Helper for pip size calculation
  const getPipMultiplier = (instr: string) => {
    const sym = (instr || "").toUpperCase();
    if (sym.includes("JPY")) return 100;
    if (sym.includes("XAU") || sym.includes("GOLD") || sym.includes("OIL") || sym.includes("BTC") || sym.includes("ETH")) return 10;
    return 10000;
  };

  const pipMultiplier = getPipMultiplier(trade?.instr);

  // Calculate Trade Quick Metrics
  const entryPrice = trade?.entryClaimed ? Number(trade.entryClaimed) : null;
  const slPrice = trade?.sl ? Number(trade.sl) : null;
  const tpPrice = trade?.tps && trade.tps.length > 0 ? Number(trade.tps[0]) : null;

  let riskPips: number | null = null;
  let rewardPips: number | null = null;
  let rrRatio: string | null = null;

  if (entryPrice && slPrice) {
    riskPips = Math.abs(entryPrice - slPrice) * pipMultiplier;
  }
  if (entryPrice && tpPrice) {
    rewardPips = Math.abs(tpPrice - entryPrice) * pipMultiplier;
  }
  if (riskPips && rewardPips && riskPips > 0) {
    rrRatio = `1 : ${(rewardPips / riskPips).toFixed(1)}`;
  }

  // Calculate Trade Duration
  let durationStr = "";
  if (trade?.signalTime && trade?.outcomeTime) {
    const diffMin = Math.round(
      (new Date(trade.outcomeTime).getTime() - new Date(trade.signalTime).getTime()) / 60000
    );
    if (diffMin < 60) {
      durationStr = `${diffMin}m`;
    } else {
      const hrs = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      durationStr = `${hrs}h ${mins}m`;
    }
  }

  // Fetch candle data whenever trade or timeframe changes
  const fetchCandles = useCallback(async () => {
    if (!trade) return;
    setLoading(true);
    setError(null);
    try {
      const adminPass = localStorage.getItem("signal_verifier_admin_pass") || "";
      const res = await fetch("/api/chart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPass,
        },
        body: JSON.stringify({
          instrument: trade.instr,
          signalTime: trade.signalTime,
          timeframe: timeframe,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to load historical tick data");
      }

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load market chart");
    } finally {
      setLoading(false);
    }
  }, [trade, timeframe]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Handle ESC key to close expanded modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Initialize and update chart
  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // Destroy existing chart if any
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
      seriesInstanceRef.current = null;
      priceLinesRef.current = [];
    }

    const container = chartContainerRef.current;

    // 1. Create Chart
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.5)" },
        horzLines: { color: "rgba(30, 41, 59, 0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(148, 163, 184, 0.3)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1e293b",
        },
        horzLine: {
          color: "rgba(148, 163, 184, 0.3)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1e293b",
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(51, 65, 85, 0.6)",
      },
      rightPriceScale: {
        borderColor: "rgba(51, 65, 85, 0.6)",
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartInstanceRef.current = chart;

    // 2. Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    candleSeries.setData(data);
    seriesInstanceRef.current = candleSeries;

    // 3. Draw Threshold Price Lines
    const newPriceLines: any[] = [];

    if (showEntryLine && trade.entryClaimed) {
      const line = candleSeries.createPriceLine({
        price: Number(trade.entryClaimed),
        color: "#3b82f6",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "ENTRY",
      });
      newPriceLines.push(line);
    }

    if (showSlLine && trade.sl) {
      const line = candleSeries.createPriceLine({
        price: Number(trade.sl),
        color: "#f43f5e",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "STOP LOSS",
      });
      newPriceLines.push(line);
    }

    if (showTpLine && trade.tps && trade.tps.length > 0) {
      const line = candleSeries.createPriceLine({
        price: Number(trade.tps[0]),
        color: "#10b981",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "TAKE PROFIT",
      });
      newPriceLines.push(line);
    }

    priceLinesRef.current = newPriceLines;

    // 4. Draw Event Markers
    if (showMarkers) {
      const markers: any[] = [];
      const firstDataTime = data[0].time;
      const lastDataTime = data[data.length - 1].time;

      // Signal Posted Marker
      if (trade.signalTime) {
        const signalTimestamp = Math.floor(new Date(trade.signalTime).getTime() / 1000);
        let signalTimeMatched = signalTimestamp;
        const exactMatch = data.find((d) => d.time === signalTimeMatched);
        if (!exactMatch && data.length > 0) {
          const closest = data.reduce((prev, curr) =>
            Math.abs(curr.time - signalTimestamp) < Math.abs(prev.time - signalTimestamp) ? curr : prev
          );
          signalTimeMatched = closest.time;
        }

        if (signalTimeMatched >= firstDataTime && signalTimeMatched <= lastDataTime) {
          markers.push({
            time: signalTimeMatched,
            position: trade.action === "BUY" ? "belowBar" : "aboveBar",
            color: trade.action === "BUY" ? "#10b981" : "#3b82f6",
            shape: trade.action === "BUY" ? "arrowUp" : "arrowDown",
            text: `SIGNAL: ${trade.action}`,
          });
        }
      }

      // Outcome Hit Marker (WIN / LOSS)
      if (trade.outcomeTime) {
        const outcomeTimestamp = Math.floor(new Date(trade.outcomeTime).getTime() / 1000);
        let outcomeTimeMatched = outcomeTimestamp;
        const exactMatch = data.find((d) => d.time === outcomeTimeMatched);
        if (!exactMatch && data.length > 0) {
          const closest = data.reduce((prev, curr) =>
            Math.abs(curr.time - outcomeTimestamp) < Math.abs(prev.time - outcomeTimestamp) ? curr : prev
          );
          outcomeTimeMatched = closest.time;
        }

        if (outcomeTimeMatched >= firstDataTime && outcomeTimeMatched <= lastDataTime) {
          markers.push({
            time: outcomeTimeMatched,
            position: trade.actualResult === "WIN" ? "aboveBar" : "belowBar",
            color: trade.actualResult === "WIN" ? "#10b981" : "#f43f5e",
            shape: "circle",
            text: `MARKET: ${trade.actualResult}`,
          });
        }
      }

      // Provider Claim Marker
      if (trade.providerClaimTime) {
        const claimTimestamp = Math.floor(new Date(trade.providerClaimTime).getTime() / 1000);
        let claimTimeMatched = claimTimestamp;
        const exactMatch = data.find((d) => d.time === claimTimeMatched);
        if (!exactMatch && data.length > 0) {
          const closest = data.reduce((prev, curr) =>
            Math.abs(curr.time - claimTimestamp) < Math.abs(prev.time - claimTimestamp) ? curr : prev
          );
          claimTimeMatched = closest.time;
        }

        if (claimTimeMatched >= firstDataTime && claimTimeMatched <= lastDataTime) {
          markers.push({
            time: claimTimeMatched,
            position: "aboveBar",
            color: "#a855f7",
            shape: "circle",
            text: `CLAIM: TP HIT`,
          });
        }
      }

      markers.sort((a, b) => a.time - b.time);
      if (markers.length > 0) {
        createSeriesMarkers(candleSeries, markers);
      }
    }

    // 5. Fit content
    chart.timeScale().fitContent();

    // 6. Crosshair Movement HUD Subscription
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || !param.seriesData.get(candleSeries)) {
        setHoverData(null);
        return;
      }

      const candle: any = param.seriesData.get(candleSeries);
      if (candle) {
        const dateObj = new Date((param.time as number) * 1000);
        const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateStr = dateObj.toLocaleDateString([], { month: "short", day: "numeric" });

        let pipsDiff: number | null = null;
        if (entryPrice) {
          const rawDiff = trade.action === "BUY" ? candle.close - entryPrice : entryPrice - candle.close;
          pipsDiff = Number((rawDiff * pipMultiplier).toFixed(1));
        }

        setHoverData({
          time: `${dateStr} ${timeStr}`,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          pipsFromEntry: pipsDiff,
        });
      }
    });

    // 7. Auto Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0 && chartInstanceRef.current && container) {
        const { width, height } = entries[0].contentRect;
        chartInstanceRef.current.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [data, trade, showEntryLine, showSlLine, showTpLine, showMarkers, isExpanded]);

  // Focus Trade Lifecycle Range
  const handleFocusTrade = () => {
    if (!chartInstanceRef.current || data.length === 0 || !trade.signalTime) return;

    const signalTs = Math.floor(new Date(trade.signalTime).getTime() / 1000);
    const endTs = trade.outcomeTime
      ? Math.floor(new Date(trade.outcomeTime).getTime() / 1000)
      : signalTs + 4 * 60 * 60; // 4 hours if ongoing

    // Add 15 mins padding on both sides
    const fromTime = signalTs - 15 * 60;
    const toTime = endTs + 15 * 60;

    chartInstanceRef.current.timeScale().setVisibleRange({
      from: fromTime as any,
      to: toTime as any,
    });
  };

  // Reset Chart View
  const handleResetZoom = () => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().fitContent();
    }
  };

  // Export Screenshot
  const handleTakeScreenshot = () => {
    if (!chartInstanceRef.current) return;
    const canvas = chartInstanceRef.current.takeScreenshot();
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `Forensic_Audit_${trade.instr || "TRADE"}_${trade.id || "chart"}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Render Inner Chart Content
  const renderChartBody = () => (
    <div className="flex flex-col w-full h-full">
      {/* Chart Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border-b border-slate-800 text-xs select-none">
        {/* Left Side: Timeframe Selectors & Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {(["m1", "m5", "m15", "h1"] as TimeframeOption[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all ${
                  timeframe === tf
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Quick Trade Badges */}
          <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-800">
            {rrRatio && (
              <span className="px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 text-[10px] font-mono border border-slate-700">
                RR: <strong className="text-indigo-300">{rrRatio}</strong>
              </span>
            )}
            {rewardPips && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                TP: +{rewardPips.toFixed(0)} pips
              </span>
            )}
            {riskPips && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-mono border border-rose-500/20">
                SL: -{riskPips.toFixed(0)} pips
              </span>
            )}
            {durationStr && (
              <span className="px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 text-[10px] font-mono border border-slate-700 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {durationStr}
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Tools & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Layer Visibility Toggles Dropdown / Buttons */}
          <div className="flex items-center bg-slate-950 px-1 py-0.5 rounded-lg border border-slate-800 gap-1">
            <button
              onClick={() => setShowEntryLine(!showEntryLine)}
              title="Toggle Entry Line"
              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                showEntryLine ? "bg-blue-500/20 text-blue-400" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              Entry
            </button>
            <button
              onClick={() => setShowSlLine(!showSlLine)}
              title="Toggle Stop Loss"
              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                showSlLine ? "bg-rose-500/20 text-rose-400" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              SL
            </button>
            <button
              onClick={() => setShowTpLine(!showTpLine)}
              title="Toggle Take Profit"
              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                showTpLine ? "bg-emerald-500/20 text-emerald-400" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              TP
            </button>
            <button
              onClick={() => setShowMarkers(!showMarkers)}
              title="Toggle Event Markers"
              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                showMarkers ? "bg-purple-500/20 text-purple-400" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              Events
            </button>
          </div>

          {/* Focus Trade Lifecycle */}
          <button
            onClick={handleFocusTrade}
            title="Focus Trade Duration"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          {/* Reset Zoom */}
          <button
            onClick={handleResetZoom}
            title="Reset Zoom"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Export Screenshot */}
          <button
            onClick={handleTakeScreenshot}
            title="Export Proof Screenshot (PNG)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-[11px]"
          >
            <Camera className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Expand / Minimize Modal */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse View (Esc)" : "Expand to Fullscreen"}
            className="p-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Chart Rendering Canvas Area */}
      <div className="relative flex-1 w-full min-h-[300px] overflow-hidden bg-slate-950">
        {/* Real-time Hover HUD Overlay */}
        {hoverData && (
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono shadow-md pointer-events-none">
            <span className="text-slate-400">{hoverData.time}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">O: <strong className="text-slate-200">{hoverData.open.toFixed(5)}</strong></span>
              <span className="text-slate-400">H: <strong className="text-slate-200">{hoverData.high.toFixed(5)}</strong></span>
              <span className="text-slate-400">L: <strong className="text-slate-200">{hoverData.low.toFixed(5)}</strong></span>
              <span className="text-slate-400">C: <strong className="text-slate-200">{hoverData.close.toFixed(5)}</strong></span>
            </div>
            {hoverData.pipsFromEntry !== null && (
              <span
                className={`font-semibold flex items-center gap-0.5 ${
                  hoverData.pipsFromEntry >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {hoverData.pipsFromEntry >= 0 ? "+" : ""}
                {hoverData.pipsFromEntry} pips
              </span>
            )}
          </div>
        )}

        {/* Loading Spinner State */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-xs text-slate-300 font-medium font-mono">
              Loading {timeframe.toUpperCase()} Dukascopy Data...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/90 text-center space-y-2">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
            <div className="text-sm font-semibold text-slate-200">Unable to Load Chart Data</div>
            <div className="text-xs text-slate-400 max-w-sm">{error}</div>
            <button
              onClick={fetchCandles}
              className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && data.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-xs text-slate-500 font-medium">
            No market tick data found for this period.
          </div>
        )}

        {/* The Lightweight Chart Container */}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );

  return (
    <>
      {/* Standard Embedded View */}
      <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-800/80 shadow-md bg-slate-950">
        {renderChartBody()}
      </div>

      {/* Expanded Centered Fullscreen Modal Overlay */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative flex flex-col w-full max-w-6xl h-[85vh] bg-slate-950 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100 uppercase font-mono tracking-wider">
                      {trade.instr || "TRADE"} Market Audit Terminal
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        trade.action === "BUY"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {trade.action}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    High-Resolution Forensic Verification • Press{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                      Esc
                    </kbd>{" "}
                    to exit
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                title="Close (Esc)"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Chart Container */}
            <div className="flex-1 w-full overflow-hidden">
              {renderChartBody()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
