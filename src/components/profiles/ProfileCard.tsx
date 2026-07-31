"use client";

import React from "react";
import { UserProfile } from "@/types/settings";
import { User, Baby, Sparkles, Film, Tv, Shield, Lock, Check } from "lucide-react";

interface ProfileCardProps {
  profile: UserProfile;
  isActive: boolean;
  onSelect: (profile: UserProfile) => void;
  onEdit?: (profile: UserProfile) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  isActive,
  onSelect,
}) => {
  const getAvatarIcon = (avatarKey: string) => {
    switch (avatarKey) {
      case "baby":
        return <Baby className="w-8 h-8 text-pink-400" />;
      case "sparkles":
        return <Sparkles className="w-8 h-8 text-amber-400" />;
      case "film":
        return <Film className="w-8 h-8 text-purple-400" />;
      case "tv":
        return <Tv className="w-8 h-8 text-emerald-400" />;
      case "shield":
        return <Shield className="w-8 h-8 text-blue-400" />;
      case "user":
      default:
        return <User className="w-8 h-8 text-cyan-400" />;
    }
  };

  const hasPin = Boolean(profile.pin || profile.pinHash);

  return (
    <button
      onClick={() => onSelect(profile)}
      data-testid={`profile-card-${profile.id}`}
      className={`group relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 select-none ${
        isActive
          ? "bg-slate-800/90 border-cyan-500 shadow-lg shadow-cyan-500/20 scale-105"
          : "bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 hover:scale-105"
      }`}
    >
      {/* Active Checkmark Badge */}
      {isActive && (
        <div className="absolute top-3 right-3 p-1 bg-cyan-500 rounded-full text-slate-950 shadow-md">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      )}

      {/* Lock Icon Badge */}
      {hasPin && (
        <div className="absolute top-3 left-3 p-1 bg-slate-800/90 rounded-full text-amber-400 border border-slate-700">
          <Lock className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Avatar Ring */}
      <div
        className={`p-4 rounded-2xl mb-3 border transition-all duration-300 ${
          isActive
            ? "bg-cyan-500/10 border-cyan-500/50 shadow-inner"
            : "bg-slate-950/60 border-slate-800 group-hover:border-cyan-500/30"
        }`}
      >
        {getAvatarIcon(profile.avatar)}
      </div>

      {/* Profile Name */}
      <h3 className="font-bold text-white text-base tracking-wide truncate max-w-[140px]">
        {profile.name}
      </h3>

      {/* Sub-label badges */}
      <div className="flex items-center gap-1.5 mt-2">
        {profile.isMaster && (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
            Master
          </span>
        )}
        {profile.isKids && (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-pink-950 text-pink-400 border border-pink-800/60">
            Kids
          </span>
        )}
        {!profile.isMaster && !profile.isKids && (
          <span className="text-[10px] font-semibold text-slate-400">
            Max: {profile.parentalControls.maxRatingLimit}
          </span>
        )}
      </div>
    </button>
  );
};
