"use client";

import React from "react";
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
} from "lucide-react";

export default function TradeDrawer({
  trade,
  onClose,
}: {
  trade: any;
  onClose: () => void;
}) {
  if (!trade) return null;

  const isWin = trade.actualResult === "WIN";
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
            ) : isWin ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <CheckCircle className="w-3.5 h-3.5" /> VERIFIED WIN
              </span>
            ) : isLoss ? (
              <span className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <XCircle className="w-3.5 h-3.5" /> VERIFIED LOSS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                <Clock className="w-3.5 h-3.5" /> EXPIRED / PENDING
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
