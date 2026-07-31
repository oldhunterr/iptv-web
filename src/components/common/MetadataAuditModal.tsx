"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Terminal,
  Database,
  Globe,
  Search,
  Tag,
  Server,
  Activity,
  History,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";

export interface RequestTraceItem {
  id: string;
  type: "tmdb_search" | "tmdb_details" | "tmdb_season" | "theme" | "xtream_info" | "imdb" | "tvdb";
  label: string;
  proxyUrl: string;
  upstreamUrl?: string;
  cacheKey?: string;
  cacheStatus: "HIT" | "MISS" | "BYPASS" | "N/A";
  status: number;
  durationMs: number;
  timestamp: string;
  rawResponse?: any;
}

export interface MetadataAuditLog {
  rawName: string;
  cleanedTitle: string;
  extractedYear?: string;
  source: "xtream" | "cache" | "tmdb" | "fallback";
  requestedLanguage: string;
  tmdbId?: number | string;
  tvdbId?: number | string;
  imdbId?: string;
  isRepeatShow?: boolean;
  previousOpenTimestamp?: string;
  openCountInSession?: number;
  requestTraceLogs: RequestTraceItem[];
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
  const [activeTab, setActiveTab] = useState<"requests" | "pipeline" | "payload">("requests");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  if (!isOpen || !auditLog) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(auditLog, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
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
                Metadata & Network Request Inspector
              </h3>
              <p className="text-xs text-slate-400">
                Live HTTP traces, upstream TMDB endpoints, and cache diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Repeat Show / Cache Warning Banner */}
        {auditLog.isRepeatShow && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2 font-medium">
              <History className="w-4 h-4 text-amber-400" />
              <span>
                <strong>Repeat Inspection:</strong> This show was opened{" "}
                <strong>{auditLog.openCountInSession} times</strong> in this session. First opened at{" "}
                <strong>{auditLog.previousOpenTimestamp}</strong>.
              </span>
            </div>
            <span className="bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 font-semibold uppercase">
              Cached Session
            </span>
          </div>
        )}

        {/* Metric Badges Header */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-950/40">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <Database className="w-3.5 h-3.5 text-cyan-400" /> Resolved Source
              </span>
              <span className="text-sm font-bold text-cyan-300 uppercase mt-1 block">
                {auditLog.source}
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <Activity className="w-3.5 h-3.5 text-amber-400" /> Requests Made
              </span>
              <span className="text-sm font-bold text-amber-300 mt-1 block">
                {auditLog.requestTraceLogs.length} calls
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

            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Open Time
              </span>
              <span className="text-sm font-bold text-emerald-300 mt-1 block truncate">
                {auditLog.timestamp}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 px-6 gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab("requests")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "requests"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>HTTP Request Trace Log ({auditLog.requestTraceLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "pipeline"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Title Pipeline & Match Candidate</span>
          </button>
          <button
            onClick={() => setActiveTab("payload")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "payload"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Complete Audit Payload</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* TAB 1: HTTP REQUEST TRACE LOG */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Real-time Network Calls for this Media Item
                </h4>
                <span className="text-[11px] text-slate-400">
                  Click any row to inspect response payload
                </span>
              </div>

              {auditLog.requestTraceLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                  No outgoing requests logged (Loaded directly from cache or local state).
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLog.requestTraceLogs.map((req, idx) => (
                    <div
                      key={req.id || idx}
                      className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden transition-all"
                    >
                      <div
                        onClick={() =>
                          setExpandedTraceId(expandedTraceId === req.id ? null : req.id)
                        }
                        className="p-3.5 flex items-center justify-between hover:bg-slate-900/60 cursor-pointer gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {expandedTraceId === req.id ? (
                            <ChevronDown className="w-4 h-4 text-cyan-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                              req.type.includes("search")
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : req.type.includes("details")
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : req.type.includes("theme")
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {req.label}
                          </span>
                          <span className="font-semibold text-slate-200 text-xs truncate">
                            {req.proxyUrl}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              req.cacheStatus === "HIT"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : req.cacheStatus === "MISS"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {req.cacheStatus}
                          </span>
                          <span
                            className={`font-bold ${
                              req.status === 200
                                ? "text-emerald-400"
                                : req.status === 404
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            {req.status}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {req.durationMs}ms
                          </span>
                        </div>
                      </div>

                      {/* Expanded Details Panel */}
                      {expandedTraceId === req.id && (
                        <div className="p-4 border-t border-slate-800 bg-slate-900/90 space-y-3 text-xs">
                          {req.upstreamUrl && (
                            <div>
                              <span className="text-slate-400 block font-semibold text-[11px] mb-1">
                                Actual Upstream TMDB API Endpoint Requested:
                              </span>
                              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-cyan-300 font-mono break-all flex items-center justify-between gap-2">
                                <span>{req.upstreamUrl}</span>
                                <a
                                  href={req.upstreamUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 hover:text-white"
                                  title="Test endpoint directly"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                </a>
                              </div>
                            </div>
                          )}

                          {req.cacheKey && (
                            <div>
                              <span className="text-slate-400 block font-semibold text-[11px] mb-1">
                                Server Cache Key:
                              </span>
                              <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 font-mono break-all">
                                {req.cacheKey}
                              </div>
                            </div>
                          )}

                          {req.rawResponse && (
                            <div>
                              <span className="text-slate-400 block font-semibold text-[11px] mb-1">
                                Response Payload Summary:
                              </span>
                              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-40">
                                {JSON.stringify(req.rawResponse, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TITLE PIPELINE & MATCH CANDIDATE */}
          {activeTab === "pipeline" && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" /> Title Cleaning Step Breakdown
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">1. Original Title (IPTV Stream):</span>
                    <span className="font-semibold text-white bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                      {auditLog.rawName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">2. Cleaned Search Query:</span>
                    <span className="font-semibold text-cyan-300 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                      {auditLog.cleanedTitle}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400">3. Parsed Release Year:</span>
                    <span className="font-semibold text-emerald-300 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                      {auditLog.extractedYear || "None extracted"}
                    </span>
                  </div>
                </div>
              </div>

              {auditLog.matchedCandidate && (
                <div className="p-5 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-4 h-4 text-yellow-400" /> TMDB Best Match Candidate Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1">Matched Name:</span>
                      <span className="font-bold text-white text-sm">
                        {auditLog.matchedCandidate.name}
                      </span>
                    </div>
                    {auditLog.matchedCandidate.originalName && (
                      <div>
                        <span className="text-slate-400 block mb-1">Original Name:</span>
                        <span className="font-semibold text-slate-300">
                          {auditLog.matchedCandidate.originalName}
                        </span>
                      </div>
                    )}
                    {auditLog.matchedCandidate.releaseDate && (
                      <div>
                        <span className="text-slate-400 block mb-1 font-medium">
                          First Air / Release Date:
                        </span>
                        <span className="font-bold text-emerald-400">
                          {auditLog.matchedCandidate.releaseDate}
                        </span>
                      </div>
                    )}
                    {auditLog.matchedCandidate.score !== undefined && (
                      <div>
                        <span className="text-slate-400 block mb-1 font-medium">
                          Match Algorithm Score:
                        </span>
                        <span className="font-extrabold text-cyan-400 text-sm">
                          {auditLog.matchedCandidate.score.toFixed(1)} / 200
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COMPLETE AUDIT PAYLOAD */}
          {activeTab === "payload" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Complete Raw Audit JSON Payload
                </h4>
                <span className="text-[11px] text-slate-400">
                  Full object state passed during resolution
                </span>
              </div>
              <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-96">
                {JSON.stringify(auditLog, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Inspector Session ID: {auditLog.timestamp}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Log JSON
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
