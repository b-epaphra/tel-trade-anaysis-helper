"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ExternalLink } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  onSelectTrade?: (tradeId: number) => void;
  className?: string;
}

// Subcomponent for Code Blocks with Copy button
function CodeBlock({ node, inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeText = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline || !match) {
    return (
      <code
        className="bg-slate-900/90 text-indigo-300 font-mono text-[11.5px] px-1.5 py-0.5 rounded border border-slate-700/60 font-medium"
        {...props}
      >
        {children}
      </code>
    );
  }

  const language = match[1];

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950/90 shadow-md">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="font-semibold text-indigo-300 uppercase tracking-wider text-[10px]">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-3.5 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({
  content,
  onSelectTrade,
  className = "",
}: MarkdownRendererProps) {
  return (
    <div className={`prose prose-invert max-w-none text-[13px] leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom Code Renderer
          code: CodeBlock,

          // Custom Table Rendering
          table: ({ children }) => (
            <div className="my-3.5 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/70 shadow-lg backdrop-blur-sm">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  {children}
                </table>
              </div>
            </div>
          ),

          thead: ({ children }) => (
            <thead className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-700/80 text-slate-300 font-semibold uppercase tracking-wider text-[10.5px]">
              {children}
            </thead>
          ),

          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-bold text-slate-200 text-left border-r border-slate-800/50 last:border-r-0 whitespace-nowrap">
              {children}
            </th>
          ),

          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
              {children}
            </tbody>
          ),

          tr: ({ children }) => (
            <tr className="hover:bg-slate-800/40 transition-colors duration-150">
              {children}
            </tr>
          ),

          td: ({ children }) => {
            const textContent = String(children);

            // Highlight status badges inside tables
            if (/^(WIN|VERIFIED|PASS|AUTHENTIC)$/i.test(textContent.trim())) {
              return (
                <td className="px-3.5 py-2 font-medium border-r border-slate-800/40 last:border-r-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    ✓ {children}
                  </span>
                </td>
              );
            }

            if (/^(LOSS|FAIL)$/i.test(textContent.trim())) {
              return (
                <td className="px-3.5 py-2 font-medium border-r border-slate-800/40 last:border-r-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                    ✕ {children}
                  </span>
                </td>
              );
            }

            if (/^(FRAUD|PHANTOM|TAMPERED|SUSPICIOUS)$/i.test(textContent.trim())) {
              return (
                <td className="px-3.5 py-2 font-medium border-r border-slate-800/40 last:border-r-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
                    ⚠ {children}
                  </span>
                </td>
              );
            }

            // Numeric or percentage values
            const isNumericOrPercent = /^[-+]?[\d,.]+%?$/.test(textContent.trim());

            return (
              <td
                className={`px-3.5 py-2 text-slate-300 border-r border-slate-800/40 last:border-r-0 ${
                  isNumericOrPercent ? "font-mono font-medium text-slate-200" : ""
                }`}
              >
                {children}
              </td>
            );
          },

          // Custom Blockquote / Callout Alerts
          blockquote: ({ children }) => {
            return (
              <div className="my-3 rounded-xl border-l-4 border-indigo-500 bg-indigo-950/20 px-4 py-3 text-slate-300 text-xs shadow-inner">
                <div className="font-sans leading-relaxed text-slate-200">
                  {children}
                </div>
              </div>
            );
          },

          // Custom Headings
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-indigo-200 mt-4 mb-2 pb-1 border-b border-indigo-500/20 flex items-center gap-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-indigo-300 mt-3.5 mb-1.5 flex items-center gap-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-semibold text-slate-200 mt-2.5 mb-1">
              {children}
            </h3>
          ),

          // Custom Paragraphs
          p: ({ children }) => (
            <p className="my-1.5 text-slate-300 leading-relaxed">
              {children}
            </p>
          ),

          // Custom Lists
          ul: ({ children }) => (
            <ul className="my-2 space-y-1 list-disc list-inside text-slate-300 pl-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1 list-decimal list-inside text-slate-300 pl-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-300 text-xs leading-relaxed">
              {children}
            </li>
          ),

          // Horizontal Divider
          hr: () => <hr className="my-3.5 border-slate-700/60" />,

          // Interactive Links & Trade Anchors
          a: ({ href, children }) => {
            const textContent = String(children);
            if (href?.startsWith("#trade-") || textContent.startsWith("#")) {
              const tradeNum = parseInt(textContent.replace(/\D/g, ""), 10);
              if (!isNaN(tradeNum)) {
                return (
                  <button
                    type="button"
                    onClick={() => onSelectTrade?.(tradeNum)}
                    className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 border border-indigo-500/30 transition-all font-bold"
                  >
                    <span>#{tradeNum}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                );
              }
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 font-medium transition-colors"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}