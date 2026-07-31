"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UserProfile, ContentRating } from "@/types/settings";
import {
  getProfiles,
  getActiveProfileId,
  setActiveProfileId,
  saveProfile,
  subscribeProfileStorage,
  hashPin,
} from "@/lib/profile-storage";
import { ProfileCard } from "./ProfileCard";
import { PinVerificationModal } from "./PinVerificationModal";
import { Users, Plus, X, Shield, Sparkles } from "lucide-react";

interface ProfileSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSwitched?: (profile: UserProfile) => void;
}

export const ProfileSelectorModal: React.FC<ProfileSelectorModalProps> = ({
  isOpen,
  onClose,
  onProfileSwitched,
}) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);

  // New Profile Creation State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newAvatar, setNewAvatar] = useState<string>("user");
  const [newIsKids, setNewIsKids] = useState<boolean>(false);
  const [newMaxRating, setNewMaxRating] = useState<ContentRating>("PG-13");
  const [newPin, setNewPin] = useState<string>("");

  const refreshProfiles = useCallback(() => {
    const list = getProfiles();
    const currId = getActiveProfileId();
    setProfiles(list);
    setActiveId(currId);
  }, []);

  useEffect(() => {
    refreshProfiles();
    const unsubscribe = subscribeProfileStorage(refreshProfiles);
    return () => unsubscribe();
  }, [refreshProfiles]);

  if (!isOpen) return null;

  const handleCardClick = (profile: UserProfile) => {
    if (profile.id === activeId) {
      onClose();
      return;
    }

    const hasPin = Boolean(profile.pin || profile.pinHash);
    if (hasPin) {
      setPendingProfile(profile);
      setShowPinModal(true);
    } else {
      activateProfile(profile);
    }
  };

  const activateProfile = (profile: UserProfile) => {
    setActiveProfileId(profile.id);
    if (onProfileSwitched) onProfileSwitched(profile);
    setShowPinModal(false);
    setPendingProfile(null);
    onClose();
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    let pinHashVal: string | undefined = undefined;
    if (newPin.length === 4) {
      pinHashVal = await hashPin(newPin);
    }

    const newProf: UserProfile = {
      id: `prof_${Date.now()}`,
      name: newName.trim(),
      avatar: newAvatar,
      isMaster: false,
      isKids: newIsKids,
      pinHash: pinHashVal,
      pin: newPin.length === 4 ? newPin : undefined,
      parentalControls: {
        enabled: newIsKids || Boolean(pinHashVal),
        maxRatingLimit: newIsKids ? "PG" : newMaxRating,
        blockUnrated: newIsKids,
        hideRestrictedContent: newIsKids,
      },
      themeSettings: {
        themeId: newIsKids ? "neon-cyber" : "dark-glass",
        accentColor: newIsKids ? "pink" : "cyan",
        glassmorphismEnabled: true,
        glassBlurIntensity: "md",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveProfile(newProf);
    setNewName("");
    setNewPin("");
    setShowAddForm(false);
  };

  return (
    <div
      data-testid="profile-selector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-2xl p-4 animate-fade-in select-none"
    >
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          data-testid="close-profile-modal"
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-cyan-600/20 border border-cyan-500/30 rounded-2xl text-cyan-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Who is watching?</h2>
            <p className="text-xs text-slate-400">Switch user profile to isolate watch history & favorites</p>
          </div>
        </div>

        {/* Profiles Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              isActive={p.id === activeId}
              onSelect={handleCardClick}
            />
          ))}

          {/* Add Profile Tile */}
          <button
            onClick={() => setShowAddForm(true)}
            data-testid="add-profile-button"
            className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-slate-800 hover:border-cyan-500/60 bg-slate-950/40 hover:bg-slate-800/40 text-slate-400 hover:text-cyan-400 transition-all group"
          >
            <div className="p-4 rounded-2xl bg-slate-900 group-hover:bg-cyan-500/10 border border-slate-800 group-hover:border-cyan-500/30 mb-3 transition-colors">
              <Plus className="w-8 h-8" />
            </div>
            <span className="font-bold text-sm">Add Profile</span>
          </button>
        </div>

        {/* Create Profile Inline Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateProfile}
            data-testid="create-profile-form"
            className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Create New Profile
              </h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-xs text-slate-500 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Profile Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  data-testid="new-profile-name-input"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Avatar Icon</label>
                <select
                  value={newAvatar}
                  onChange={(e) => setNewAvatar(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="user">User (Cyan)</option>
                  <option value="baby">Kids (Pink)</option>
                  <option value="sparkles">Sparkles (Amber)</option>
                  <option value="film">Film (Purple)</option>
                  <option value="tv">TV (Emerald)</option>
                  <option value="shield">Shield (Blue)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-pink-400" />
                <div>
                  <p className="text-xs font-semibold text-white">Kids Profile Restriction</p>
                  <p className="text-[10px] text-slate-400">Restricts catalog to PG/TV-PG content</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={newIsKids}
                onChange={(e) => setNewIsKids(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            {!newIsKids && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Max Rating Limit</label>
                  <select
                    value={newMaxRating}
                    onChange={(e) => setNewMaxRating(e.target.value as ContentRating)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="G">G (General)</option>
                    <option value="PG">PG</option>
                    <option value="PG-13">PG-13</option>
                    <option value="R">R (Restricted)</option>
                    <option value="NC-17">NC-17 / TV-MA</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">4-Digit PIN (Optional)</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="e.g. 1234"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono tracking-widest"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              data-testid="submit-new-profile"
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/30 transition-colors"
            >
              Save & Create Profile
            </button>
          </form>
        )}
      </div>

      {/* PIN Verification Modal */}
      {pendingProfile && (
        <PinVerificationModal
          profile={pendingProfile}
          isOpen={showPinModal}
          onClose={() => {
            setShowPinModal(false);
            setPendingProfile(null);
          }}
          onSuccess={() => activateProfile(pendingProfile)}
        />
      )}
    </div>
  );
};
