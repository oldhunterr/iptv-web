"use client";

import React, { useState } from "react";
import { X, Copy, Check, Terminal, Database, Globe, Search, Tag, Server } from "lucide-react";

export interface MetadataAuditLog {
  rawName: string;
  cleanedTitle: string;
  extractedYear?: string;
  source: "xtream" | "cache" | "tmdb" | "fallback";
  requestedLanguage: string;
  tmdbId?: number | string;
  tvdbId?: number | string;
  imdbId?: string;
  searchUrl?: string;
  detailsUrl?: string;
  cacheHeader?: string;
  matchedCandidate?: {
    id: number | string;
    name: string;
    originalName?: string;
    score?: number;
    releaseDate?: string;
  };
  rawPayload?: any;
  timestamp: string;
}

interface MetadataAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLog: MetadataAuditLog | null;
}

export const MetadataAuditModal: React.FC<MetadataAuditModalProps> = ({
  isOpen,
  onClose,
  auditLog,
}) => {
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen || !auditLog) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(auditLog, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Metadata Debug & Resolution Log
              </h3>
              <p className="text-xs text-slate-400">
                Full request trace, title transformations, and API payloads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <Database className="w-3.5 h-3.5 text-cyan-400" /> Data Source
              </span>
              <span className="text-sm font-bold text-cyan-300 uppercase mt-1 block">
                {auditLog.source}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <Server className="w-3.5 h-3.5 text-amber-400" /> Cache Status
              </span>
              <span
                className={`text-sm font-bold mt-1 block ${
                  auditLog.cacheHeader === "HIT"
                    ? "text-emerald-400"
                    : auditLog.cacheHeader === "MISS"
                    ? "text-amber-400"
                    : "text-slate-400"
                }`}
              >
                {auditLog.cacheHeader || "N/A"}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <Globe className="w-3.5 h-3.5 text-purple-400" /> Language
              </span>
              <span className="text-sm font-bold text-purple-300 mt-1 block">
                {auditLog.requestedLanguage}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <Tag className="w-3.5 h-3.5 text-yellow-400" /> TMDB ID
              </span>
              <span className="text-sm font-bold text-yellow-400 mt-1 block truncate">
                {auditLog.tmdbId ? `#${auditLog.tmdbId}` : "None"}
              </span>
            </div>
          </div>

          {/* Title Cleaning Breakdown */}
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" /> Title Transformation Pipeline
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Raw Name (IPTV Playlist):</span>
                <span className="font-semibold text-white bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  {auditLog.rawName}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Cleaned Search Query:</span>
                <span className="font-semibold text-cyan-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  {auditLog.cleanedTitle}
                </span>
              </div>
              {auditLog.extractedYear && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-400">Extracted Release Year:</span>
                  <span className="font-semibold text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {auditLog.extractedYear}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Matched Candidate Details */}
          {auditLog.matchedCandidate && (
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                TMDB Candidate Match Score
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Matched Name:</span>
                  <span className="font-semibold text-white">
                    {auditLog.matchedCandidate.name}
                  </span>
                </div>
                {auditLog.matchedCandidate.originalName && (
                  <div>
                    <span className="text-slate-400 block">Original Name:</span>
                    <span className="font-semibold text-slate-300">
                      {auditLog.matchedCandidate.originalName}
                    </span>
                  </div>
                )}
                {auditLog.matchedCandidate.releaseDate && (
                  <div>
                    <span className="text-slate-400 block">Air / Release Date:</span>
                    <span className="font-semibold text-emerald-400">
                      {auditLog.matchedCandidate.releaseDate}
                    </span>
                  </div>
                )}
                {auditLog.matchedCandidate.score !== undefined && (
                  <div>
                    <span className="text-slate-400 block">Match Score:</span>
                    <span className="font-semibold text-cyan-400">
                      {auditLog.matchedCandidate.score.toFixed(1)} / 200
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Executed URLs */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              API Proxy Requests Executed
            </h4>
            {auditLog.searchUrl && (
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 break-all">
                <span className="text-slate-500 font-bold mr-2">SEARCH:</span>
                {auditLog.searchUrl}
              </div>
            )}
            {auditLog.detailsUrl && (
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-purple-300 break-all">
                <span className="text-slate-500 font-bold mr-2">DETAILS:</span>
                {auditLog.detailsUrl}
              </div>
            )}
          </div>

          {/* Raw Payload Section */}
          <div>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline flex items-center gap-1 cursor-pointer"
            >
              {showRawJson ? "Hide Raw Resolution Payload" : "View Complete Raw Resolution Payload"}
            </button>
            {showRawJson && (
              <pre className="mt-3 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                {JSON.stringify(auditLog, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Timestamp: {auditLog.timestamp}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Log JSON
                </>
              ) }
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
