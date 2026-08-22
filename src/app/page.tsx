"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "next-themes";
import {
  Play,
  FileText,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Zap,
  BarChart2,
  Lock,
  Unlock,
  Sun,
  Moon,
  Database,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Sparkles,
  Check,
  Copy,
  Info,
  Eye,
} from "lucide-react";
import TradeDrawer from "@/components/TradeDrawer";
import IgnoredMessagesDrawer from "@/components/IgnoredMessagesDrawer";
import { IgnoredMessageItem } from "@/lib/telegram-service";

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Auth & Settings
  const [adminPassword, setAdminPassword] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Core Search & Ingestion Parameters
  const [channelId, setChannelId] = useState("-1001297305044");
  const [days, setDays] = useState("30");
  const [processingMode, setProcessingMode] = useState<"normal" | "hard">("normal");

  // Loading & Progress
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [cachedStats, setCachedStats] = useState<{ cachedOld: number; recent: number } | null>(null);

  // Results & Filtering
  const [results, setResults] = useState<any[] | null>(null);
  const [ignoredMessages, setIgnoredMessages] = useState<IgnoredMessageItem[]>([]);
  const [showIgnoredDrawer, setShowIgnoredDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "FRAUD" | "WIN" | "MANUAL_WIN" | "LOSS" | "ACTIVE" | "EXPIRED" | "UNSUPPORTED">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Drawer state
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);

  // AI Report Settings
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4o");
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedPass = localStorage.getItem("signal_verifier_admin_pass");
      if (savedPass) setAdminPassword(savedPass);

      const savedAiKey = localStorage.getItem("signal_verifier_ai_key");
      if (savedAiKey) setApiKey(savedAiKey);

      const savedAiBase = localStorage.getItem("signal_verifier_ai_base");
      if (savedAiBase) setBaseURL(savedAiBase);

      const savedAiModel = localStorage.getItem("signal_verifier_ai_model");
      if (savedAiModel) setModel(savedAiModel);

      const cached = localStorage.getItem("signal_verifier_trades");
      if (cached) {
        setResults(JSON.parse(cached));
      }
      const cachedReport = localStorage.getItem("signal_verifier_report");
      if (cachedReport) {
        setReport(cachedReport);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (adminPassword) {
      headers["x-admin-password"] = adminPassword;
    }
    return headers;
  };

  const handleSaveAdminPassword = (pass: string) => {
    setAdminPassword(pass);
    localStorage.setItem("signal_verifier_admin_pass", pass);
    setShowAuthModal(false);
  };
  const handleAnalyze = async () => {
    setLoading(true);
    setResults(null);
    setReport(null);
    setCachedStats(null);
    setProgressPercent(0);
    setProgressMsg("Connecting to Telegram & Database...");

    const requestedDays = parseInt(days, 10) || 30;

    try {
      let initialSignals: any[] = [];
      let collectedIgnored: IgnoredMessageItem[] = [];

      if (processingMode === "hard" && requestedDays > 15) {
        setProgressMsg("Hard Re-Sync: Ingesting Telegram in batches...");
        let offsetId = 0;
        let hasMore = true;
        let chunkCount = 0;
        const nowTs = Math.floor(Date.now() / 1000);
        const cutoffTs = nowTs - requestedDays * 86400;

        while (hasMore && chunkCount < 15) {
          chunkCount++;
          setProgressMsg(`Fetching Telegram Chunk #${chunkCount} (offset ${offsetId})...`);
          setProgressPercent(Math.min(30, chunkCount * 5));

          const chunkRes = await fetch("/api/sync/chunk", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              channelId,
              offsetId,
              limit: 100,
              cutoffTimestamp: cutoffTs,
            }),
          });

          if (chunkRes.status === 401) {
            setShowAuthModal(true);
            alert("Unauthorized: Please enter the Admin Password.");
            setLoading(false);
            return;
          }

          const chunkData = await chunkRes.json();
          if (chunkData.error) {
            alert("Error in chunk sync: " + chunkData.error);
            break;
          }

          if (chunkData.data?.signals) {
            initialSignals.push(...chunkData.data.signals);
          }
          if (chunkData.data?.ignoredMessages) {
            collectedIgnored.push(...chunkData.data.ignoredMessages);
          }

          offsetId = chunkData.data?.lastOffsetId || 0;
          hasMore = chunkData.data?.hasMore || false;
        }

        const unique = new Map<number, any>();
        for (const s of initialSignals) unique.set(s.id, s);
        initialSignals = Array.from(unique.values());

        const uniqueIgnored = new Map<number, IgnoredMessageItem>();
        for (const m of collectedIgnored) uniqueIgnored.set(m.id, m);
        setIgnoredMessages(Array.from(uniqueIgnored.values()));
      } else {
        setProgressMsg(
          processingMode === "normal"
            ? "Syncing fresh 30d + checking DB cache for older records..."
            : "Scraping Telegram Messages..."
        );
        setProgressPercent(20);

        const scrapeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            channelId,
            days: requestedDays,
            mode: processingMode,
          }),
        });

        if (scrapeRes.status === 401) {
          setShowAuthModal(true);
          alert("Unauthorized: Please configure the Admin Password.");
          setLoading(false);
          return;
        }

        const scrapeData = await scrapeRes.json();
        if (scrapeData.error) {
          alert("Scraping Error: " + scrapeData.error);
          setLoading(false);
          return;
        }

        initialSignals = scrapeData.data || [];
        setIgnoredMessages(scrapeData.ignoredMessages || []);

        if (scrapeData.cachedOldCount !== undefined) {
          setCachedStats({
            cachedOld: scrapeData.cachedOldCount,
            recent: scrapeData.recentCount,
          });
        }
      }

      if (!initialSignals || initialSignals.length === 0) {
        alert("No supported signals found in that timeframe.");
        setLoading(false);
        return;
      }

      setResults(initialSignals);
      setProgressPercent(35);
      setProgressMsg(`Simulating 0 / ${initialSignals.length} Trades...`);

      const simulatedResults: any[] = [];
      const CHUNK_SIZE = 3;

      for (let i = 0; i < initialSignals.length; i += CHUNK_SIZE) {
        const chunk = initialSignals.slice(i, i + CHUNK_SIZE);

        const promises = chunk.map(async (signal: any) => {
          if (
            signal.actualResult &&
            signal.actualResult !== "PENDING" &&
            signal.actualResult !== "ERROR" &&
            processingMode === "normal"
          ) {
            return signal;
          }

          try {
            const simRes = await fetch("/api/simulate", {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify({
                ...signal,
                forceResimulate: processingMode === "hard",
              }),
            });
            const simData = await simRes.json();
            return simData.data || signal;
          } catch (e) {
            return { ...signal, actualResult: "ERROR", fraudDetected: false };
          }
        });

        const chunkResults = await Promise.all(promises);
        simulatedResults.push(...chunkResults);

        const currentPct = 35 + Math.round(((i + chunk.length) / initialSignals.length) * 65);
        setProgressPercent(Math.min(100, currentPct));
        setProgressMsg(
          `Simulating ${Math.min(i + chunk.length, initialSignals.length)} / ${initialSignals.length} Trades...`
        );

        setResults([...simulatedResults, ...initialSignals.slice(i + chunk.length)]);
      }

      localStorage.setItem("signal_verifier_trades", JSON.stringify(simulatedResults));
      setProgressMsg("");
    } catch (err: any) {
      console.error(err);
      alert("Failed to execute verification pipeline: " + err.message);
    }
    setLoading(false);
  };

  const handleGenerateReport = async () => {
    if (!results || !apiKey) {
      alert("Please run analysis and provide an API Key first.");
      return;
    }
    setReportLoading(true);
    try {
      localStorage.setItem("signal_verifier_ai_key", apiKey);
      localStorage.setItem("signal_verifier_ai_base", baseURL);
      localStorage.setItem("signal_verifier_ai_model", model);

      const res = await fetch("/api/report", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ results, apiKey, baseURL, model }),
      });
      const data = await res.json();
      if (data.error) {
        alert("Error: " + data.error);
      } else {
        setReport(data.report);
        localStorage.setItem("signal_verifier_report", data.report);
      }
    } catch (err: any) {
      alert("Failed to generate AI report: " + err.message);
    }
    setReportLoading(false);
  };

  const copyReportToClipboard = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  const totalCount = results ? results.length : 0;
  const trueWins = results ? results.filter((t) => t.actualResult === "WIN").length : 0;
  const manualWins = results ? results.filter((t) => t.actualResult === "MANUAL_WIN").length : 0;
  const trueLosses = results ? results.filter((t) => t.actualResult === "LOSS").length : 0;
  const fraudCount = results ? results.filter((t) => t.fraudDetected).length : 0;
  const activeCount = results ? results.filter((t) => t.actualResult === "ACTIVE").length : 0;
  const unsupportedCount = results ? results.filter((t) => t.actualResult === "UNSUPPORTED_DATA" || !t.instr).length : 0;
  const winRate =
    totalCount > 0 ? (((trueWins + manualWins) / (trueWins + manualWins + trueLosses || 1)) * 100).toFixed(1) : "0";

  const filteredResults = (results || []).filter((trade) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchAsset = trade.asset?.toLowerCase().includes(q);
      const matchMsg = trade.msg?.toLowerCase().includes(q);
      const matchId = String(trade.id).includes(q);
      if (!matchAsset && !matchMsg && !matchId) return false;
    }
    if (fromDate) {
      if (new Date(trade.signalTime) < new Date(fromDate)) return false;
    }
    if (toDate) {
      const nextDay = new Date(toDate);
      nextDay.setDate(nextDay.getDate() + 1);
      if (new Date(trade.signalTime) >= nextDay) return false;
    }

    if (filterStatus === "FRAUD") return trade.fraudDetected;
    if (filterStatus === "WIN") return trade.actualResult === "WIN";
    if (filterStatus === "MANUAL_WIN") return trade.actualResult === "MANUAL_WIN";
    if (filterStatus === "LOSS") return trade.actualResult === "LOSS";
    if (filterStatus === "ACTIVE") return trade.actualResult === "ACTIVE";
    if (filterStatus === "EXPIRED") return trade.actualResult === "EXPIRED";
    if (filterStatus === "UNSUPPORTED") return trade.actualResult === "UNSUPPORTED_DATA" || !trade.instr;
    return true;
  });

  const totalPages = Math.ceil(filteredResults.length / rowsPerPage);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  if (!mounted) return null;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-10 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Navigation Bar */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1">
                  <span>Signal</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">
                    Proof
                  </span>
                </span>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  v2.0 Forensic Edition
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Institutional Telegram Signal Verification & 1-Minute Tick Backtesting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              onClick={() => setShowAuthModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                adminPassword
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {adminPassword ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {adminPassword ? "Admin Unlocked" : "Set Password"}
            </button>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Toggle Theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Ingestion & Control Hub */}
        <div className="bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                Signal Verification & Sync Controls
              </h2>
              <p className="text-xs text-slate-400">
                Choose between Smart Caching (fast differential sync) or Hard Process (full re-verification).
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setProcessingMode("normal")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  processingMode === "normal"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Normal Mode (Smart Cache)
              </button>
              <button
                onClick={() => setProcessingMode("hard")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  processingMode === "hard"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Hard Process (Full Re-sync)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
            <div className="sm:col-span-6 md:col-span-5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Telegram Channel ID / Username
              </label>
              <input
                type="text"
                placeholder="e.g. -1001297305044 or @forexsignals"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-3 md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Timeframe (Days)
              </label>
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-full py-1.5 bg-transparent text-sm text-slate-200 focus:outline-none font-bold"
                />
                <span className="text-xs text-slate-500 font-medium">Days</span>
              </div>
            </div>

            <div className="sm:col-span-3 md:col-span-4 flex items-end">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full mt-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] text-white py-3 px-5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/25"
              >
                {loading ? (
                  <Clock className="animate-spin w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                {loading
                  ? "Processing Ingestion..."
                  : processingMode === "hard"
                  ? "Hard Re-process All"
                  : "Run Forensic Audit"}
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2.5">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            {processingMode === "normal" ? (
              <span>
                <strong>Smart Caching active:</strong> Fetches last 30 days fresh from Telegram to
                capture edited posts, and seamlessly pulls &gt;30d history from PostgreSQL cache without
                rate-limiting Dukascopy.
              </span>
            ) : (
              <span>
                <strong>Hard Re-sync active:</strong> Bypasses database cache, executes chunked
                re-ingestion from Telegram, and re-calculates 1-minute tick simulations for all trades.
              </span>
            )}
          </div>

          {loading && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/30 space-y-2 animate-pulse">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  {progressMsg}
                </span>
                <span className="text-indigo-400">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}

          {cachedStats && !loading && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> {cachedStats.recent} Signals Synced Fresh (Last 30d)
              </span>
              {cachedStats.cachedOld > 0 && (
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-xl flex items-center gap-1.5">
                  <Database className="w-3 h-3" /> {cachedStats.cachedOld} Historical Signals Loaded from DB Cache
                </span>
              )}
              {ignoredMessages.length > 0 && (
                <button
                  onClick={() => setShowIgnoredDrawer(true)}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all text-xs font-semibold cursor-pointer shadow-sm"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> {ignoredMessages.length} Ignored Messages
                </button>
              )}
            </div>
          )}
          {!cachedStats && !loading && ignoredMessages.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => setShowIgnoredDrawer(true)}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all text-xs font-semibold cursor-pointer shadow-sm"
              >
                <AlertCircle className="w-3.5 h-3.5" /> View {ignoredMessages.length} Ignored Messages
              </button>
            </div>
          )}
        </div>

        {/* Forensic KPI Stats Grid */}
        {results && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Ingested Signals
              </div>
              <div className="text-2xl font-black text-slate-100 mt-1">{totalCount}</div>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-emerald-500/20 shadow-sm">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                True Market Wins
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{trueWins}</div>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-rose-500/20 shadow-sm">
              <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                True Market Losses
              </div>
              <div className="text-2xl font-black text-rose-400 mt-1">{trueLosses}</div>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-red-500/30 shadow-sm">
              <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                Fraudulent Wins Claimed
              </div>
              <div className="text-2xl font-black text-red-400 mt-1 flex items-center gap-1.5">
                {fraudCount}
                {fraudCount > 0 && <AlertTriangle className="w-4 h-4 text-red-400" />}
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-2xl border border-indigo-500/20 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                True Backtest Win Rate
              </div>
              <div className="text-2xl font-black text-indigo-400 mt-1">{winRate}%</div>
            </div>
          </div>
        )}

        {/* Signals Table & Filter Container */}
        {results && results.length > 0 && (
          <div className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <BarChart2 className="text-indigo-400 w-5 h-5" />
                  Signal Truth & Dukascopy Verification
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any trade row to view full Dukascopy tick chart breakdown and original message text.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-medium text-slate-400 ml-2">From:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-400">To:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer"
                  />
                </div>
                
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search asset, ID, msg..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setFilterStatus("ALL")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterStatus === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    All ({results.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus("FRAUD")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterStatus === "FRAUD"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "text-slate-400 hover:text-red-400"
                    }`}
                  >
                    Fraud ({fraudCount})
                  </button>
                  <button
                    onClick={() => setFilterStatus("WIN")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterStatus === "WIN"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "text-slate-400 hover:text-emerald-400"
                    }`}
                  >
                    Wins ({trueWins})
                  </button>
                  <button
                    onClick={() => setFilterStatus("MANUAL_WIN")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterStatus === "MANUAL_WIN"
                        ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                        : "text-slate-400 hover:text-teal-400"
                    }`}
                  >
                    Manual Wins ({manualWins})
                  </button>
                  <button
                    onClick={() => setFilterStatus("LOSS")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterStatus === "LOSS"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "text-slate-400 hover:text-rose-400"
                    }`}
                  >
                    Losses ({trueLosses})
                  </button>
                  {activeCount > 0 && (
                    <button
                      onClick={() => setFilterStatus("ACTIVE")}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        filterStatus === "ACTIVE"
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "text-slate-400 hover:text-cyan-400"
                      }`}
                    >
                      Active ({activeCount})
                    </button>
                  )}
                  {unsupportedCount > 0 && (
                    <button
                      onClick={() => setFilterStatus("UNSUPPORTED")}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        filterStatus === "UNSUPPORTED"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "text-slate-400 hover:text-purple-400"
                      }`}
                    >
                      Unsupported ({unsupportedCount})
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4 font-semibold w-12">S.No</th>
                    <th className="py-3.5 px-4 font-semibold">Signal / Date</th>
                    <th className="py-3.5 px-4 font-semibold">Instrument & Action</th>
                    <th className="py-3.5 px-4 font-semibold">Claimed Entry</th>
                    <th className="py-3.5 px-4 font-semibold">Market Result</th>
                    <th className="py-3.5 px-4 font-semibold">Provider Claim</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Integrity Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {paginatedResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No signals matching the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedResults.map((trade, i) => (
                      <tr
                        key={trade.id || i}
                        onClick={() => setSelectedTrade(trade)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          {(currentPage - 1) * rowsPerPage + i + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                            #{trade.id}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(trade.signalTime).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            •{" "}
                            {new Date(trade.signalTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold ${
                              trade.action === "BUY"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {trade.action === "BUY" ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {trade.asset} {trade.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                          {trade.entryClaimed}
                        </td>
                        <td className="py-3.5 px-4">
                          {!trade.actualResult ? (
                            <span className="bg-slate-800 text-slate-400 font-semibold px-2 py-0.5 rounded-lg animate-pulse">
                              Simulating...
                            </span>
                          ) : (
                            <span
                              className={`font-bold px-2.5 py-1 rounded-xl border ${
                                trade.actualResult === "WIN"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : trade.actualResult === "MANUAL_WIN"
                                  ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
                                  : trade.actualResult === "LOSS"
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                  : trade.actualResult === "ACTIVE"
                                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                  : trade.actualResult === "DATA_GAP"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : trade.actualResult === "UNSUPPORTED_DATA"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {trade.actualResult === "MANUAL_WIN" ? "MANUAL WIN" : trade.actualResult}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {trade.providerClaimMsg ? (
                            <div>
                              <span className="text-purple-300 font-medium bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                                "{trade.providerClaimMsg}"
                              </span>
                              <div className="text-[10px] text-slate-500 mt-1">
                                {new Date(trade.providerClaimTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No update posted</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {trade.fraudDetected ? (
                            <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full font-bold">
                              <AlertTriangle className="w-3 h-3" /> FAKED WIN
                            </span>
                          ) : (trade.actualResult === "WIN" || trade.actualResult === "MANUAL_WIN") && trade.providerClaimMsg ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" /> {trade.actualResult === "MANUAL_WIN" ? "Honest (Manual)" : "Honest"}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button className="inline-flex items-center gap-1 text-indigo-400 font-semibold hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-1 rounded-xl transition-all">
                            Audit <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={150}>150</option>
                </select>
                <span className="text-slate-500 ml-2">
                  Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredResults.length)} of {filteredResults.length} entries
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 disabled:opacity-50 hover:bg-slate-800 disabled:hover:bg-slate-950 transition-colors"
                >
                  Previous
                </button>
                <div className="text-slate-300 font-medium px-2">
                  Page {currentPage} of {Math.max(totalPages, 1)}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 disabled:opacity-50 hover:bg-slate-800 disabled:hover:bg-slate-950 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Intelligence Report Generator */}
        {results && results.length > 0 && !loading && (
          <div className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="text-indigo-400 w-5 h-5" />
                  AI Institutional Fraud & Forensic Report
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synthesize the verified trade logs into an executive-grade forensic dossier via OpenAI or LiteLLM.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <input
                type="password"
                placeholder="LiteLLM / OpenAI API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Base URL (e.g. https://api.openai.com/v1)"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Model (e.g. gpt-4o, claude-3-5-sonnet)"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50 shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {reportLoading ? (
                  <Clock className="animate-spin w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {reportLoading ? "Synthesizing Dossier..." : "Generate AI Forensic Report"}
              </button>
            </div>

            {report && (
              <div className="bg-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Generated Dossier
                  </span>
                  <button
                    onClick={copyReportToClipboard}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl transition-all"
                  >
                    {reportCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {reportCopied ? "Copied!" : "Copy Report Markdown"}
                  </button>
                </div>
                <div className="prose prose-invert prose-indigo max-w-none text-xs leading-relaxed">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Password Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Backend Access Authentication</h3>
                <p className="text-xs text-slate-400">Configure your ADMIN_PASSWORD</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If an <code>ADMIN_PASSWORD</code> is set in your <code>.env</code> on Vercel, enter it
              below so your browser can authenticate API requests.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                Admin Password / Secret Key
              </label>
              <input
                type="password"
                placeholder="Enter password..."
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveAdminPassword(adminPassword)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/30"
              >
                Save & Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Trade Details Drawer */}
      <TradeDrawer trade={selectedTrade} onClose={() => setSelectedTrade(null)} />

      {/* Slide-out Ignored Messages Drawer */}
      <IgnoredMessagesDrawer
        isOpen={showIgnoredDrawer}
        onClose={() => setShowIgnoredDrawer(false)}
        ignoredMessages={ignoredMessages}
      />
    </div>
  );
}
