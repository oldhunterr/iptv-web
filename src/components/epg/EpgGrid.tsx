"use client";

import React, { useState, useMemo } from "react";
import { Play, Clock, Info, Calendar, Tv, Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { LiveChannel, EpgProgram } from "@/types/iptv";

export interface EpgGridProps {
  channels: LiveChannel[];
  programsMap: Record<string | number, EpgProgram[]>;
  onSelectChannel?: (channel: LiveChannel) => void;
  onSelectProgram?: (program: EpgProgram, channel: LiveChannel) => void;
  currentTime?: Date;
  className?: string;
}

export const EpgGrid: React.FC<EpgGridProps> = ({
  channels,
  programsMap,
  onSelectChannel,
  onSelectProgram,
  currentTime = new Date(),
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<{
    program: EpgProgram;
    channel: LiveChannel;
  } | null>(null);

  const currentUnix = Math.floor(currentTime.getTime() / 1000);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase().trim();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, searchQuery]);

  const getProgramProgress = (program: EpgProgram) => {
    if (!program.start_timestamp || !program.stop_timestamp) return 0;
    if (currentUnix < program.start_timestamp) return 0;
    if (currentUnix > program.stop_timestamp) return 100;

    const total = program.stop_timestamp - program.start_timestamp;
    const elapsed = currentUnix - program.start_timestamp;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const isLiveProgram = (program: EpgProgram) => {
    if (!program.start_timestamp || !program.stop_timestamp) return false;
    return currentUnix >= program.start_timestamp && currentUnix <= program.stop_timestamp;
  };

  const formatTime = (isoOrTime: string | number) => {
    if (typeof isoOrTime === "number") {
      const d = new Date(isoOrTime * 1000);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (isoOrTime.includes("T") || isoOrTime.includes("-")) {
      const d = new Date(isoOrTime);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    }
    return isoOrTime;
  };

  return (
    <div
      data-testid="epg-grid-container"
      className={`flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${className}`}
    >
      {/* EPG Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 text-base">Electronic Program Guide</h2>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Current Time: {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            data-testid="epg-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main EPG Grid View */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {filteredChannels.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No live channels available.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredChannels.map((channel) => {
              const progs = programsMap[channel.stream_id] || programsMap[channel.epg_channel_id || ""] || [];
              const currentProg = progs.find(isLiveProgram) || progs[0];
              const progress = currentProg ? getProgramProgress(currentProg) : 0;

              return (
                <div
                  key={channel.stream_id}
                  data-testid={`epg-channel-row-${channel.stream_id}`}
                  className="flex flex-col md:flex-row md:items-center justify-between p-3.5 hover:bg-slate-800/40 transition-colors gap-3"
                >
                  {/* Channel Meta */}
                  <div className="flex items-center gap-3 w-full md:w-64 flex-shrink-0">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0">
                      {channel.stream_icon ? (
                        <img
                          src={channel.stream_icon}
                          alt={channel.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Tv className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm text-slate-200 truncate">
                        {channel.name}
                      </h4>
                      <span className="text-[10px] text-indigo-400 font-mono">
                        CH {channel.num || channel.stream_id}
                      </span>
                    </div>
                    {onSelectChannel && (
                      <button
                        type="button"
                        data-testid={`play-channel-${channel.stream_id}`}
                        onClick={() => onSelectChannel(channel)}
                        className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center"
                        title="Watch Live Channel"
                      >
                        <Play className="w-4 h-4 fill-white" />
                      </button>
                    )}
                  </div>

                  {/* Program Timeline Slider / Current & Upcoming Program Cards */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {progs.length > 0 ? (
                      progs.slice(0, 3).map((prog) => {
                        const live = isLiveProgram(prog);
                        const progProgress = getProgramProgress(prog);

                        return (
                          <div
                            key={prog.id}
                            data-testid={`epg-program-card-${prog.id}`}
                            onClick={() => {
                              setSelectedProgram({ program: prog, channel });
                              if (onSelectProgram) onSelectProgram(prog, channel);
                            }}
                            className={`relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                              live
                                ? "bg-slate-800/90 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/40"
                                : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[11px] font-medium text-slate-400">
                                {formatTime(prog.start)} - {formatTime(prog.stop)}
                              </span>
                              {live && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase bg-rose-500 text-white animate-pulse">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <h5 className="font-semibold text-xs text-slate-200 truncate mb-1">
                              {prog.title}
                            </h5>
                            {prog.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1">
                                {prog.description}
                              </p>
                            )}

                            {/* Live Progress Bar */}
                            {live && (
                              <div className="mt-2 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${progProgress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-full p-2 rounded-xl bg-slate-950/40 border border-slate-800/50 text-slate-500 text-xs text-center">
                        No EPG schedule data for this channel
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Program Details Modal */}
      {selectedProgram && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            data-testid="epg-program-modal"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in duration-200"
          >
            <button
              type="button"
              data-testid="close-epg-modal-btn"
              onClick={() => setSelectedProgram(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
                {selectedProgram.channel.name}
              </span>
              {isLiveProgram(selectedProgram.program) && (
                <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-500 text-white">
                  NOW PLAYING
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-slate-100 mb-2">
              {selectedProgram.program.title}
            </h3>

            <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-indigo-400" />
                {formatTime(selectedProgram.program.start)} - {formatTime(selectedProgram.program.stop)}
              </span>
              {selectedProgram.program.category && (
                <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  {selectedProgram.program.category}
                </span>
              )}
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              {selectedProgram.program.description || "No detailed program overview available."}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedProgram(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
              >
                Close
              </button>
              {onSelectChannel && (
                <button
                  type="button"
                  data-testid="play-from-modal-btn"
                  onClick={() => {
                    onSelectChannel(selectedProgram.channel);
                    setSelectedProgram(null);
                  }}
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors flex items-center gap-2 shadow-lg"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Watch Channel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
