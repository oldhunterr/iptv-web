"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ThemeSettings, ThemePresetId, ACCENT_SWATCHES } from "@/types/settings";
import { getActiveProfile, saveProfile, subscribeProfileStorage } from "@/lib/profile-storage";

export interface ThemePresetDefinition {
  id: ThemePresetId;
  name: string;
  description: string;
  bgApp: string;
  bgSurface: string;
  bgSurfaceHover: string;
  bgGlass: string;
  borderSubtle: string;
  textPrimary: string;
  textMuted: string;
  defaultAccentKey: string;
}

export const THEME_PRESETS: Record<ThemePresetId, ThemePresetDefinition> = {
  "dark-glass": {
    id: "dark-glass",
    name: "Dark Glass",
    description: "Modern slate aesthetic with cyan accent glow & frosted glass overlays",
    bgApp: "#0f172a",
    bgSurface: "#1e293b",
    bgSurfaceHover: "#334155",
    bgGlass: "rgba(15, 23, 42, 0.75)",
    borderSubtle: "#334155",
    textPrimary: "#f8fafc",
    textMuted: "#94a3b8",
    defaultAccentKey: "cyan",
  },
  "oled-black": {
    id: "oled-black",
    name: "OLED Pure Black",
    description: "Zero pixel power black theme optimized for high-contrast OLED screens",
    bgApp: "#000000",
    bgSurface: "#09090b",
    bgSurfaceHover: "#18181b",
    bgGlass: "rgba(0, 0, 0, 0.85)",
    borderSubtle: "#27272a",
    textPrimary: "#fafafa",
    textMuted: "#a1a1aa",
    defaultAccentKey: "emerald",
  },
  "neon-cyber": {
    id: "neon-cyber",
    name: "Neon Cyber",
    description: "Vibrant cyberpunk synthwave palette with electric pink & neon glows",
    bgApp: "#0a0a16",
    bgSurface: "#121124",
    bgSurfaceHover: "#1f1c3a",
    bgGlass: "rgba(10, 10, 22, 0.8)",
    borderSubtle: "#2d285c",
    textPrimary: "#fdf4ff",
    textMuted: "#a78bfa",
    defaultAccentKey: "pink",
  },
  "classic-tivimate": {
    id: "classic-tivimate",
    name: "Classic Tivimate",
    description: "Deep steel navy TV guide design inspired by Tivimate IPTV player",
    bgApp: "#0d1b2a",
    bgSurface: "#1b263b",
    bgSurfaceHover: "#415a77",
    bgGlass: "rgba(13, 27, 42, 0.8)",
    borderSubtle: "#415a77",
    textPrimary: "#e0e1dd",
    textMuted: "#778da9",
    defaultAccentKey: "cyan",
  },
};

interface ThemeContextType {
  themeSettings: ThemeSettings;
  activePreset: ThemePresetDefinition;
  updateTheme: (newSettings: Partial<ThemeSettings>) => void;
  setThemePreset: (presetId: ThemePresetId) => void;
  setAccentSwatch: (accentKey: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>(() => {
    const profile = getActiveProfile();
    return profile.themeSettings || {
      themeId: "dark-glass",
      accentColor: "cyan",
      glassmorphismEnabled: true,
      glassBlurIntensity: "md",
    };
  });

  const syncThemeFromProfile = useCallback(() => {
    const profile = getActiveProfile();
    if (profile.themeSettings) {
      setThemeSettingsState(profile.themeSettings);
    }
  }, []);

  useEffect(() => {
    syncThemeFromProfile();
    const unsubscribe = subscribeProfileStorage(syncThemeFromProfile);
    return () => unsubscribe();
  }, [syncThemeFromProfile]);

  // Apply CSS custom properties dynamically to :root
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const preset = THEME_PRESETS[themeSettings.themeId] || THEME_PRESETS["dark-glass"];
    const accent = ACCENT_SWATCHES[themeSettings.accentColor] || ACCENT_SWATCHES.cyan;

    root.setAttribute("data-theme", themeSettings.themeId);

    // Apply color variables
    root.style.setProperty("--bg-app", preset.bgApp);
    root.style.setProperty("--bg-surface", preset.bgSurface);
    root.style.setProperty("--bg-surface-hover", preset.bgSurfaceHover);
    root.style.setProperty("--bg-glass", themeSettings.glassmorphismEnabled ? preset.bgGlass : preset.bgSurface);
    root.style.setProperty("--border-subtle", preset.borderSubtle);
    root.style.setProperty("--text-primary", preset.textPrimary);
    root.style.setProperty("--text-muted", preset.textMuted);

    // Accent Variables
    root.style.setProperty("--accent-primary", accent.primary);
    root.style.setProperty("--accent-hover", accent.hover);
    root.style.setProperty("--accent-light", accent.light);
    root.style.setProperty("--accent-glow", accent.glow);

    // Glassmorphism Blur Intensity
    let blurPx = "16px";
    if (themeSettings.glassBlurIntensity === "none" || !themeSettings.glassmorphismEnabled) blurPx = "0px";
    else if (themeSettings.glassBlurIntensity === "sm") blurPx = "8px";
    else if (themeSettings.glassBlurIntensity === "md") blurPx = "16px";
    else if (themeSettings.glassBlurIntensity === "lg") blurPx = "24px";

    root.style.setProperty("--glass-blur", blurPx);
  }, [themeSettings]);

  const updateTheme = (newSettings: Partial<ThemeSettings>) => {
    const updated: ThemeSettings = { ...themeSettings, ...newSettings };
    setThemeSettingsState(updated);

    // Save to active profile
    const activeProfile = getActiveProfile();
    activeProfile.themeSettings = updated;
    saveProfile(activeProfile);

    // Persist iptv_theme_config JSON schema for inline anti-FOUC script
    try {
      if (typeof window !== "undefined") {
        const themeConfigJson = {
          version: "2.0",
          themeId: updated.themeId,
          accentColor: updated.accentColor,
          glassmorphismEnabled: updated.glassmorphismEnabled,
          glassBlurIntensity: updated.glassBlurIntensity,
          customCSS: updated.customCSS || "",
          updatedAt: Date.now(),
        };
        localStorage.setItem("iptv_theme_config", JSON.stringify(themeConfigJson));
      }
    } catch (e) {
      console.error("Failed to save iptv_theme_config:", e);
    }
  };

  const setThemePreset = (presetId: ThemePresetId) => {
    const preset = THEME_PRESETS[presetId];
    updateTheme({
      themeId: presetId,
      accentColor: preset ? preset.defaultAccentKey : "cyan",
    });
  };

  const setAccentSwatch = (accentKey: string) => {
    updateTheme({ accentColor: accentKey });
  };

  const activePreset = THEME_PRESETS[themeSettings.themeId] || THEME_PRESETS["dark-glass"];

  return (
    <ThemeContext.Provider
      value={{
        themeSettings,
        activePreset,
        updateTheme,
        setThemePreset,
        setAccentSwatch,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
