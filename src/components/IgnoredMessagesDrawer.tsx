"use client";

import React, { useState } from "react";
import {
  X,
  AlertCircle,
  MessageSquare,
  Search,
  Filter,
  Calendar,
  Layers,
  Copy,
  Check,
  Info,
} from "lucide-react";
import { IgnoredMessageItem } from "@/lib/telegram-service";

export default function IgnoredMessagesDrawer({
  isOpen,
  onClose,
  ignoredMessages,
}: {
  isOpen: boolean;
  onClose: () => void;
  ignoredMessages: IgnoredMessageItem[];
}) {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  if (!isOpen) return null;

  const filtered = ignoredMessages.filter(
    (m) =>
      m.text.toLowerCase().includes(search.toLowerCase()) ||
      m.reason.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toString().includes(search)
  );

  const copyToClipboard = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-900 text-slate-100 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col border-l border-slate-800">
        {/* Header */}
        <div className="bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                Ignored & Unparsed Messages ({ignoredMessages.length})
              </h2>
              <p className="text-xs text-slate-400">
                Messages containing trade keywords that did not meet strict signal criteria.
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar & Filter */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search ignored messages or reasons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* List of Ignored Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
              <p className="font-medium text-sm">No ignored messages found.</p>
              <p className="text-xs text-slate-600 mt-1">
                {ignoredMessages.length === 0
                  ? "All messages were either valid signals or regular updates."
                  : "No messages match your search query."}
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                      #{item.id}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.date).toLocaleString()}
                    </span>
                  </div>

                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    {item.reason}
                  </span>
                </div>

                <div className="relative bg-slate-900 p-3 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap break-words">
                  {item.text}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>
                    {item.replyToMsgId ? `Reply to #${item.replyToMsgId}` : "Direct Message"}
                  </span>
                  <button
                    onClick={() => copyToClipboard(item.id, item.text)}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
