"use client";
import React, { useEffect, useRef } from "react";
import { createChart, CrosshairMode, LineStyle, ColorType, CandlestickSeries, createSeriesMarkers } from "lightweight-charts";

interface TradeChartProps {
  data: any[];
  trade: any;
}

export default function TradeChart({ data, trade }: TradeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // 1. Initialize Chart with Dark Theme
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8', // text-slate-400
      },
      grid: {
        vertLines: { color: '#1e293b' }, // border-slate-800
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1e293b',
      },
      rightPriceScale: {
        borderColor: '#1e293b',
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

    // 2. Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // emerald-500
      downColor: '#f43f5e', // rose-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    candleSeries.setData(data);

    // 3. Draw Threshold Lines (Entry, SL, TP)
    if (trade.entryClaimed) {
      candleSeries.createPriceLine({
        price: Number(trade.entryClaimed),
        color: '#3b82f6', // blue-500
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'Entry',
      });
    }

    if (trade.sl) {
      candleSeries.createPriceLine({
        price: Number(trade.sl),
        color: '#f43f5e', // rose-500
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'SL',
      });
    }

    if (trade.tps && trade.tps.length > 0) {
      candleSeries.createPriceLine({
        price: Number(trade.tps[0]),
        color: '#10b981', // emerald-500
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'TP1',
      });
    }

    // 4. Add Event Markers
    const markers: any[] = [];
    const signalTimestamp = Math.floor(new Date(trade.signalTime).getTime() / 1000);
    
    // Check if signal timestamp is within chart data range to place the marker
    const firstDataTime = data[0].time;
    const lastDataTime = data[data.length - 1].time;

    let signalTimeMatched = signalTimestamp;
    
    // Snap signalTime to closest candle time if exactly not found to ensure it displays
    const exactMatch = data.find(d => d.time === signalTimeMatched);
    if (!exactMatch && data.length > 0) {
      const closest = data.reduce((prev, curr) => 
        Math.abs(curr.time - signalTimestamp) < Math.abs(prev.time - signalTimestamp) ? curr : prev
      );
      signalTimeMatched = closest.time;
    }

    if (signalTimeMatched >= firstDataTime && signalTimeMatched <= lastDataTime) {
      markers.push({
        time: signalTimeMatched,
        position: trade.action === 'BUY' ? 'belowBar' : 'aboveBar',
        color: trade.action === 'BUY' ? '#10b981' : '#3b82f6',
        shape: trade.action === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: `Signal Posted (${trade.action})`,
      });
    }

    if (trade.outcomeTime) {
      const outcomeTimestamp = Math.floor(new Date(trade.outcomeTime).getTime() / 1000);
      let outcomeTimeMatched = outcomeTimestamp;
      const exactMatchOutcome = data.find(d => d.time === outcomeTimeMatched);
      if (!exactMatchOutcome && data.length > 0) {
        const closest = data.reduce((prev, curr) => 
          Math.abs(curr.time - outcomeTimestamp) < Math.abs(prev.time - outcomeTimestamp) ? curr : prev
        );
        outcomeTimeMatched = closest.time;
      }
      
      if (outcomeTimeMatched >= firstDataTime && outcomeTimeMatched <= lastDataTime) {
        markers.push({
          time: outcomeTimeMatched,
          position: trade.actualResult === 'WIN' ? 'aboveBar' : 'belowBar',
          color: trade.actualResult === 'WIN' ? '#10b981' : '#f43f5e',
          shape: 'circle',
          text: `${trade.actualResult} Hit`,
        });
      }
    }

    if (trade.providerClaimTime) {
      const claimTimestamp = Math.floor(new Date(trade.providerClaimTime).getTime() / 1000);
      let claimTimeMatched = claimTimestamp;
      const exactMatchClaim = data.find(d => d.time === claimTimeMatched);
      if (!exactMatchClaim && data.length > 0) {
         const closest = data.reduce((prev, curr) => 
          Math.abs(curr.time - claimTimestamp) < Math.abs(prev.time - claimTimestamp) ? curr : prev
        );
        claimTimeMatched = closest.time;
      }

      if (claimTimeMatched >= firstDataTime && claimTimeMatched <= lastDataTime) {
        markers.push({
          time: claimTimeMatched,
          position: 'aboveBar',
          color: '#a855f7', // purple-500
          shape: 'circle',
          text: `Provider Claim`,
        });
      }
    }

    // Sort markers by time as required by lightweight-charts
    markers.sort((a, b) => a.time - b.time);
    
    if (markers.length > 0) {
      createSeriesMarkers(candleSeries, markers);
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle Window Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, trade]);

  return (
    <div className="w-full h-80 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/50" ref={chartContainerRef} />
  );
}
