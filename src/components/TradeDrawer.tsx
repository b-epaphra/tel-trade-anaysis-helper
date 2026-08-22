"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Cpu,
  GitBranch,
  Terminal,
  Activity,
  Check,
  HelpCircle,
} from "lucide-react";
import TradeChart from "./TradeChart";

export default function TradeDrawer({
  trade,
  onClose,
}: {
  trade: any;
  onClose: () => void;
}) {
  if (!trade) return null;

  const isWin = trade.actualResult === "WIN";
  const isManualWin = trade.actualResult === "MANUAL_WIN";
  const isLoss = trade.actualResult === "LOSS";
  const isExpired = trade.actualResult === "EXPIRED";

  const entryDifference = trade.entryActual
    ? (trade.entryClaimed - trade.entryActual).toFixed(4)
    : null;

  return (
    <>
      {/* Dark Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-900 text-slate-100 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col border-l border-slate-800 overflow-hidden">
        {/* Drawer Header */}
        <div className="bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-slate-100 text-lg">Trade Verification Breakdown</h2>
              <p className="text-xs text-slate-400">ID #{trade.id} • Forensic Audit Details</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trade.fraudDetected ? (
              <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5" /> FRAUD DETECTED
              </span>
            ) : trade.actualResult === "UNSUPPORTED_DATA" ? (
              <span className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <HelpCircle className="w-3.5 h-3.5" /> UNSUPPORTED ASSET
              </span>
            ) : trade.actualResult === "ACTIVE" ? (
              <span className="inline-flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <Clock className="w-3.5 h-3.5" /> ACTIVE (OPEN)
              </span>
            ) : isWin ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <CheckCircle className="w-3.5 h-3.5" /> VERIFIED WIN
              </span>
            ) : isManualWin ? (
              <span className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <CheckCircle className="w-3.5 h-3.5" /> VERIFIED MANUAL WIN
              </span>
            ) : isLoss ? (
              <span className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <XCircle className="w-3.5 h-3.5" /> VERIFIED LOSS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <Clock className="w-3.5 h-3.5" /> EXPIRED (NO TARGET HIT)
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Signal Overview Card */}
          <div className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">
                    #{trade.id}
                  </span>
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(trade.signalTime).toLocaleString()}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-slate-100 flex items-center gap-3 mt-2">
                  {trade.asset}
                  <span
                    className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-lg font-bold ${
                      trade.action === "BUY"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {trade.action === "BUY" ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {trade.action}
                  </span>
                </h1>
              </div>

              {trade.instr && (
                <span className="text-xs font-mono bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                  {trade.instr}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800/80">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Claimed Entry</div>
                <div className="text-lg font-bold text-slate-200 mt-0.5">{trade.entryClaimed}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stop Loss</div>
                <div className="text-lg font-bold text-rose-400 mt-0.5">{trade.sl || "N/A"}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Take Profit (TP1)</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{trade.tps?.[0] || "N/A"}</div>
              </div>
            </div>
          </div>

          {/* Section: Interactive Market Tick Chart */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Interactive Market Tick Verification Chart
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Dukascopy Tick Data • Forensic Canvas</span>
            </div>
            
            <TradeChart trade={trade} />
          </div>

          {/* Section: Forensic Audit Working Process / Timeline */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-indigo-500/30 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Audit Working Process & Decision Flow
              </div>
              <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/20">
                Tick-by-Tick Audit Trail
              </span>
            </div>

            <div className="space-y-4 text-xs relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 pl-8">
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -left-8 top-0.5 w-5 h-5 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                  1
                </div>
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>Signal Ingestion & Parameter Extraction</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono">Parsed</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Extracted <strong className="text-slate-300">{trade.asset} {trade.action}</strong> @ <strong className="text-slate-300">{trade.entryClaimed}</strong> (SL: {trade.sl}, TP1: {trade.tps?.[0]}) from Telegram message.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="absolute -left-8 top-0.5 w-5 h-5 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                  2
                </div>
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>1-Minute Tick Ingestion & Slippage Check</span>
                    {entryDifference !== null ? (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        Math.abs(Number(entryDifference)) > 0 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        Slippage: {entryDifference}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Pulled Dukascopy 1-min rate for <strong className="text-slate-300">{trade.instr}</strong>. Real market entry open tick was <strong className="text-slate-200 font-mono">{trade.entryActual ?? "N/A"}</strong>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="absolute -left-8 top-0.5 w-5 h-5 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                  3
                </div>
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>Path & Priority Simulation (5-Day Window)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      isWin
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : isManualWin
                        ? "bg-teal-500/10 text-teal-400 border border-teal-500/30"
                        : isLoss
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {trade.actualResult === "MANUAL_WIN" ? "MANUAL WIN" : (trade.actualResult || "Pending")}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {trade.action === "SELL" ? (
                      <>Condition: If High &ge; {trade.sl} &rarr; LOSS, If Low &le; {trade.tps?.[0]} &rarr; WIN.</>
                    ) : (
                      <>Condition: If Low &le; {trade.sl} &rarr; LOSS, If High &ge; {trade.tps?.[0]} &rarr; WIN.</>
                    )}
                    {trade.durationMinutes && (
                      <span className="block text-slate-300 mt-0.5">
                        &bull; Breached target at minute <strong className="text-indigo-400 font-mono">{trade.durationMinutes}</strong> ({trade.outcomeTime ? new Date(trade.outcomeTime).toLocaleTimeString() : ""}).
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <div className="absolute -left-8 top-0.5 w-5 h-5 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                  4
                </div>
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>Telegram Channel Claim Cross-Examination</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {trade.providerClaimMsg ? (
                      <span>
                        Provider claimed: <strong className="text-purple-300">"{trade.providerClaimMsg}"</strong> at {trade.providerClaimTime ? new Date(trade.providerClaimTime).toLocaleTimeString() : ""}.
                      </span>
                    ) : (
                      <span>No winner/profit update was posted by the provider in the channel.</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="relative">
                <div className={`absolute -left-8 top-0.5 w-5 h-5 rounded-full bg-slate-900 border-2 flex items-center justify-center text-[10px] font-bold ${
                  trade.fraudDetected ? "border-red-500 text-red-400" : isWin ? "border-emerald-500 text-emerald-400" : isManualWin ? "border-teal-500 text-teal-400" : "border-slate-600 text-slate-400"
                }`}>
                  5
                </div>
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>Forensic Integrity Verdict</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {trade.fraudDetected ? (
                      <span className="text-red-400 font-semibold">
                        🚨 Deception: Stop loss triggered before provider's win announcement.
                      </span>
                    ) : isWin && trade.providerClaimMsg ? (
                      <span className="text-emerald-400 font-semibold">
                        ✅ Corroborated: Take profit hit and verified by tick data.
                      </span>
                    ) : isManualWin && trade.providerClaimMsg ? (
                      <span className="text-teal-400 font-semibold">
                        ✅ Corroborated: Manual profit claim verified by favorable excursion prior to update.
                      </span>
                    ) : isLoss && !trade.providerClaimMsg ? (
                      <span className="text-slate-300">
                        ⚪ Silent Loss: Stop loss hit; provider omitted reporting the loss.
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        Evaluated with standard integrity checks.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {/* Card 1: Original Telegram Message */}
            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                Original Telegram Signal Content
              </div>
              <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
                {trade.msg}
              </div>
            </div>

            {/* Card 2: Market Verification Truth */}
            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Dukascopy Historical Market Verification
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400">Actual Market Entry (1m Tick)</span>
                  <span className="font-mono font-bold text-slate-200">
                    {trade.entryActual ?? "Pending simulation"}
                  </span>
                </div>

                {entryDifference !== null && (
                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400">Entry Price Deviation</span>
                    <span
                      className={`font-mono font-bold ${
                        Math.abs(Number(entryDifference)) > 0 ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {entryDifference}{" "}
                      {Number(entryDifference) > 0
                        ? "(Claimed higher)"
                        : Number(entryDifference) < 0
                        ? "(Claimed lower)"
                        : "(Exact Match)"}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400">Real Market Outcome</span>
                  <span
                    className={`font-bold uppercase ${
                      isWin ? "text-emerald-400" : isLoss ? "text-rose-400" : "text-amber-400"
                    }`}
                  >
                    {trade.actualResult || "Pending..."}
                  </span>
                </div>

                {trade.outcomeTime && (
                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400">Timestamp of TP/SL Hit</span>
                    <span className="font-mono text-slate-300">
                      {new Date(trade.outcomeTime).toLocaleString()}
                    </span>
                  </div>
                )}

                {trade.durationMinutes && (
                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400">Duration to Hit</span>
                    <span className="font-medium text-slate-200">
                      {trade.durationMinutes} minutes
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Integrity / Fraud Summary */}
            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                {trade.fraudDetected ? (
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                )}
                Forensic Fraud & Transparency Evaluation
              </div>

              {trade.fraudDetected ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2 text-xs text-red-200">
                  <div className="font-bold flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" /> Deception Confirmed
                  </div>
                  <p>
                    The provider claimed <strong>"{trade.providerClaimMsg}"</strong> in the channel,
                    but historical 1-minute tick data proves the Stop Loss was hit first.
                  </p>
                </div>
              ) : isWin && trade.providerClaimMsg ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-xs text-emerald-200">
                  <div className="font-bold flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" /> Honest Verified Claim
                  </div>
                  <p>The provider claimed a win and market tick data corroborates the hit.</p>
                </div>
              ) : isWin && !trade.providerClaimMsg ? (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2 text-xs text-blue-200">
                  <div className="font-bold flex items-center gap-2 text-blue-400 text-sm">
                    <CheckCircle className="w-4 h-4" /> Unclaimed Winner
                  </div>
                  <p>The trade reached Take Profit, but provider did not post a confirmation reply.</p>
                </div>
              ) : isLoss && !trade.providerClaimMsg ? (
                <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2 text-xs text-slate-300">
                  <div className="font-bold flex items-center gap-2 text-slate-300 text-sm">
                    <Clock className="w-4 h-4" /> Silent Loss (Survivorship Bias)
                  </div>
                  <p>The trade touched Stop Loss, and was quietly ignored without any channel announcement.</p>
                </div>
              ) : (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs text-amber-200">
                  <div className="font-bold flex items-center gap-2 text-amber-400 text-sm">
                    <Clock className="w-4 h-4" /> Inactive / Expired
                  </div>
                  <p>Price remained between SL and TP targets for the 24-hour test window.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
