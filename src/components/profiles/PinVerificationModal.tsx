"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UserProfile } from "@/types/settings";
import { verifyProfilePin, checkPinRateLimit } from "@/lib/profile-storage";
import { Lock, X, Delete, ShieldAlert } from "lucide-react";

interface PinVerificationModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
  profile,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pinDigits, setPinDigits] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [lockoutSec, setLockoutSec] = useState<number>(0);

  // Check rate limiting status
  const updateLockoutStatus = useCallback(() => {
    const status = checkPinRateLimit();
    if (status.isLocked) {
      setLockoutSec(status.remainingSeconds);
    } else {
      setLockoutSec(0);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPinDigits("");
      setErrorMsg("");
      setIsShaking(false);
      return;
    }
    updateLockoutStatus();
  }, [isOpen, updateLockoutStatus]);

  // Lockout Countdown Timer
  useEffect(() => {
    if (lockoutSec <= 0) return;
    const interval = setInterval(() => {
      setLockoutSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSec]);

  const submitPin = useCallback(async (code: string) => {
    const isValid = await verifyProfilePin(profile, code);
    if (isValid) {
      setPinDigits("");
      onSuccess();
    } else {
      setIsShaking(true);
      setPinDigits("");
      const status = checkPinRateLimit();
      if (status.isLocked) {
        setLockoutSec(status.remainingSeconds);
        setErrorMsg(`Too many failed attempts. Locked for ${status.remainingSeconds}s.`);
      } else {
        setErrorMsg("Incorrect 4-digit PIN. Try again.");
      }
      setTimeout(() => setIsShaking(false), 500);
    }
  }, [profile, onSuccess]);

  const handleDigitPress = useCallback((digit: string) => {
    if (lockoutSec > 0 || pinDigits.length >= 4) return;
    const nextDigits = pinDigits + digit;
    setPinDigits(nextDigits);
    setErrorMsg("");

    if (nextDigits.length === 4) {
      submitPin(nextDigits);
    }
  }, [lockoutSec, pinDigits, submitPin]);

  const handleBackspace = useCallback(() => {
    if (lockoutSec > 0 || pinDigits.length === 0) return;
    setPinDigits((prev) => prev.slice(0, -1));
    setErrorMsg("");
  }, [lockoutSec, pinDigits.length]);

  // Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigitPress(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleDigitPress, handleBackspace, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="pin-verification-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fade-in"
    >
      <div
        className={`relative w-full max-w-sm bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl transition-transform ${
          isShaking ? "animate-bounce border-red-500/80" : ""
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          data-testid="close-pin-modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-white">Enter PIN</h2>
          <p className="text-xs text-slate-400 mt-1">
            Verification required for <span className="text-cyan-400 font-semibold">{profile.name}</span>
          </p>
        </div>

        {/* 4 Digit Display Dots */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = idx < pinDigits.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  isFilled
                    ? "bg-cyan-400 border-cyan-400 shadow-md shadow-cyan-400/50 scale-110"
                    : "bg-slate-950 border-slate-700"
                }`}
              />
            );
          })}
        </div>

        {/* Error / Lockout Message */}
        {lockoutSec > 0 ? (
          <div className="flex items-center justify-center gap-2 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-400 text-xs font-semibold text-center mb-4">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Lockout active. Retry in {lockoutSec}s</span>
          </div>
        ) : errorMsg ? (
          <p className="text-xs text-red-400 font-medium text-center mb-4">{errorMsg}</p>
        ) : (
          <p className="text-[11px] text-slate-500 text-center mb-4">Type digits or click on keypad</p>
        )}

        {/* Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleDigitPress(num)}
              disabled={lockoutSec > 0}
              data-testid={`pin-key-${num}`}
              className="py-3 text-lg font-bold text-white bg-slate-950/70 hover:bg-cyan-600/30 active:bg-cyan-600/50 border border-slate-800 hover:border-cyan-500/40 rounded-2xl transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setPinDigits("")}
            disabled={lockoutSec > 0 || pinDigits.length === 0}
            className="py-3 text-xs font-bold text-slate-400 hover:text-white bg-slate-950/40 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all disabled:opacity-30"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigitPress("0")}
            disabled={lockoutSec > 0}
            data-testid="pin-key-0"
            className="py-3 text-lg font-bold text-white bg-slate-950/70 hover:bg-cyan-600/30 active:bg-cyan-600/50 border border-slate-800 hover:border-cyan-500/40 rounded-2xl transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={lockoutSec > 0 || pinDigits.length === 0}
            data-testid="pin-key-backspace"
            className="py-3 flex items-center justify-center text-slate-400 hover:text-white bg-slate-950/40 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all disabled:opacity-30"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
