# Architectural Specification & Implementation Plan: Phase 2 IPTV Web Player

**Target Application**: `iptv-nextjs` (`c:\Users\Sayed Ali\Desktop\iptv web testing\iptv-nextjs`)  
**Version**: 2.0.0-phase2  
**Date**: July 30, 2026  
**Status**: Approved Specification  

---

## Executive Summary & Architectural Overview

Phase 2 elevates the IPTV Web Player from a baseline catalog viewer into an enterprise-grade streaming platform achieving parity with **Plex**, **Jellyfin**, and **Tivimate**. This document defines the comprehensive blueprint for four core feature domains along with deep technical specifications:

1. **UI Themes & Visual Customization**: Dynamic CSS custom property engine, 4 preset design systems (`dark-glass`, `oled-black`, `neon-cyber`, `classic-tivimate`), customizable accent palettes, glassmorphic surface styling, anti-FOUC boot execution, and schema-validated theme persistence.
2. **User Profiles & Parental Control Guard**: Multi-profile switcher architecture, normalized rating weight hierarchy (`G` through `NC-17` / `TV-Y` through `TV-MA`), rating regex parser (`[18+]`, `UK 15`), `blockUnrated` boolean guard, Adult Category (`group-title`) lock spec, SHA-256 PIN hashing with brute-force rate limiting, and namespaced storage isolation.
3. **Hybrid Offline Downloads Engine**: Dual-tier storage architecture leveraging Cache Storage API for HLS video segments/MP4 chunks and IndexedDB for transactional metadata/queue state, complete with a Service Worker HTTP 206 Partial Content Range request handler, an HLS.js custom loader plugin, storage quota management, and token expiration renewal.
4. **Offloaded Advanced Content Filtering**: Web Worker-offloaded indexing engine capable of searching and filtering 50,000+ IPTV items under 12ms, paired with zero-copy `Transferable` ArrayBuffers, IPTV metadata facets (`group-title`, `streamType`: Live/VOD/Series, `resolution`: 4K/1080p/720p, `hasEpg`), quick filter pills, multi-criteria sliders, and virtualized list integration.

---

## 1. Feature 1: UI Themes & Customization Architecture

### 1.1 Competitive Parity Matrix (Plex & Jellyfin)

| Aspect | **Plex** | **Jellyfin** | **Tivimate** | **IPTV Web Player (Phase 2)** |
| :--- | :--- | :--- | :--- | :--- |
| **Theme Engine** | Bundle skins + fanart blur | CSS injection + skin plugins | Pre-built TV color matrices | **Dynamic CSS Root Injection Engine** via React Context Provider & Inline Anti-FOUC Boot |
| **Styling Binding** | Static client CSS | Custom CSS variables | Native Android color mappings | **Tailwind CSS variables** mapped to `:root` custom properties |
| **Presets** | Modern Dark, Light | Default Dark, Purple Haze | Dark Blue, OLED | **`dark-glass`**, **`oled-black`**, **`neon-cyber`**, **`classic-tivimate`** |
| **Accent Palette** | Amber (`#E5A00D`) | Dynamic RGB palette | Cyan, Green, Gold | **6 Swatches** (Cyan, Amber, Emerald, Purple, Pink, Crimson) |
| **Glassmorphism** | Backdrop poster blur | Semi-transparent overlays | Transparent EPG overlays | **Custom backdrop-blur slider** (`none`, `sm`, `md`, `lg`) + glow borders |
| **FOUC Prevention** | Server-side SSR theme tag | Server static rendering | Native instant render | **Next.js inline anti-FOUC boot script** reading `iptv_theme_config` JSON |

### 1.2 Dynamic CSS Variable Binding Architecture

The styling engine uses CSS Custom Properties defined at the `:root` element. Tailwind CSS colors are mapped directly to these CSS variables, permitting real-time theme changes without re-compiling styles or causing re-renders of static UI elements.

#### CSS Variables Matrix (`globals.css`)
```css
:root {
  /* Surface & Background Variables */
  --bg-app: #0f172a;
  --bg-surface: #1e293b;
  --bg-surface-hover: #334155;
  --bg-glass: rgba(15, 23, 42, 0.75);

  /* Border & Highlight Variables */
  --border-subtle: #334155;
  --border-glow: rgba(6, 182, 212, 0.4);

  /* Text & Typography Variables */
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;

  /* Accent Color Palette */
  --accent-primary: #06b6d4;
  --accent-hover: #0891b2;
  --accent-light: #22d3ee;
  --accent-glow: rgba(6, 182, 212, 0.35);

  /* Glassmorphic Blur Settings */
  --glass-blur: 16px;
}
```

### 1.3 Production Theme Presets

1. **`dark-glass` (Default Hub)**:
   - App BG: `#0f172a` (Slate 950) | Surface BG: `#1e293b` (Slate 900)
   - Primary Accent: `#06b6d4` (Cyan 500) | Glass: `rgba(15, 23, 42, 0.75)` with `16px` blur.
2. **`oled-black` (OLED Pure Dark)**:
   - App BG: `#000000` (Pitch Black) | Surface BG: `#09090b` (Zinc 950)
   - Primary Accent: `#10b981` (Emerald 500) | Border: `#27272a` (High Contrast).
3. **`neon-cyber` (Synthwave Cyberpunk)**:
   - App BG: `#0a0a16` (Deep Midnight) | Surface BG: `#121124` (Dark Violet)
   - Primary Accent: `#ec4899` (Electric Pink) | Glow: `rgba(236, 72, 153, 0.4)`.
4. **`classic-tivimate` (Navy TV Player)**:
   - App BG: `#0d1b2a` (Tivimate Dark Navy) | Surface BG: `#1b263b` (Steel Blue)
   - Primary Accent: `#00b4d8` (Bright Teal) | Muted Text: `#778da9`.

### 1.4 Technical Spec 1: Next.js Inline Anti-FOUC Boot Script & JSON Persistence Schema

#### 1.4.1 Anti-FOUC Boot Script (`layout.tsx` injection)
To eliminate Flash of Unstyled Content (FOUC) when loading the app prior to React hydration, an inline synchronous script is injected into the `<head>` element:

```html
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          var raw = localStorage.getItem('iptv_theme_config');
          if (!raw) raw = localStorage.getItem('iptv_theme_settings_v1');
          if (raw) {
            var cfg = JSON.parse(raw);
            var root = document.documentElement;
            if (cfg.themeId) root.setAttribute('data-theme', cfg.themeId);
            if (cfg.accentColor) {
              var sw = {
                cyan: '#06b6d4', amber: '#f59e0b', emerald: '#10b981',
                purple: '#8b5cf6', pink: '#ec4899', crimson: '#ef4444'
              };
              var color = sw[cfg.accentColor] || cfg.accentColor;
              root.style.setProperty('--accent-primary', color);
            }
            if (cfg.glassBlurIntensity) {
              var blurMap = { none: '0px', sm: '8px', md: '16px', lg: '24px' };
              root.style.setProperty('--glass-blur', blurMap[cfg.glassBlurIntensity] || '16px');
            }
          }
        } catch (e) {}
      })();
    `,
  }}
/>
```

#### 1.4.2 `iptv_theme_config` JSON Persistence Schema
Theme configuration state is persisted under `localStorage` key `iptv_theme_config` conforming to the following JSON schema specification:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "IPTVThemeConfig",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["2.0"] },
    "themeId": {
      "type": "string",
      "enum": ["dark-glass", "oled-black", "neon-cyber", "classic-tivimate"]
    },
    "accentColor": {
      "type": "string",
      "pattern": "^(cyan|amber|emerald|purple|pink|crimson|#[0-9a-fA-F]{6})$"
    },
    "glassmorphismEnabled": { "type": "boolean" },
    "glassBlurIntensity": {
      "type": "string",
      "enum": ["none", "sm", "md", "lg"]
    },
    "customCSS": { "type": "string" },
    "updatedAt": { "type": "integer" }
  },
  "required": ["version", "themeId", "accentColor", "glassmorphismEnabled", "glassBlurIntensity", "updatedAt"]
}
```

---

## 2. Feature 2: User Profiles & Parental Controls Architecture

### 2.1 Competitive Parity (Plex Home & Jellyfin Users)

- **Plex Parity**: Supports multi-user profile switching, PIN-protected admin accounts, restricted managed/kids profiles, and custom rating ceilings (G, PG, PG-13, R, NC-17).
- **Jellyfin Parity**: Provides granular folder/category locks, unrated item blocking, and isolated watch histories per user account.

### 2.2 Profile Switcher & Execution Lifecycle

```
 ┌──────────────────────────────────────────────────────────┐
 │                  Active Profile Context                  │
 └────────────────────────────┬─────────────────────────────┘
                              │ Switch Profile Trigger
                              v
                Does Target Profile require PIN?
                              │
               ┌──────────────┴──────────────┐
               │ YES                         │ NO
               v                             v
 ┌───────────────────────────┐ ┌───────────────────────────┐
 │   PinVerificationModal    │ │   Activate Target Profile │
 │  (4-Digit Numeric Pad)    │ │   Load Namespaced Keys    │
 └─────────────┬─────────────┘ └───────────────────────────┘
               │ PIN Validated
               v
 ┌───────────────────────────┐
 │   Activate Target Profile │
 │   Update Theme & Ratings  │
 └───────────────────────────┘
```

### 2.3 Standardized Rating Weight Hierarchy Engine

The application normalizes both MPAA (Movie) and TV Parental Guidelines into a numeric weight hierarchy ranging from `10` (General Audience) to `100` (Mature Adults Only):

```typescript
export const RATING_WEIGHTS: Record<string, number> = {
  "G": 10,     "TV-Y": 10,
  "TV-Y7": 15, "TV-G": 20,
  "PG": 30,    "TV-PG": 35,
  "PG-13": 50, "TV-14": 60,
  "R": 80,     "NC-17": 90,
  "TV-MA": 100, "UNRATED": 70
};
```

### 2.4 Technical Spec 2: Rating Normalization Regex, `blockUnrated` Guard & Adult Category Lock

#### 2.4.1 Profile Rating Normalization Regex Engine
IPTV M3U headers and Xtream metadata present ratings in diverse localized formats (`[18+]`, `UK 15`, `(18+)`, `TV-MA`, `R18`). The system uses regex normalization:

```typescript
export function parseRatingString(rawRating?: string): ContentRating {
  if (!rawRating) return "UNRATED";
  const str = rawRating.trim();
  
  // Regex pattern matching bracketed ratings, UK ratings, and standard MPAA/TV tags
  const ratingRegex = /(?:\[?(\d{1,2}\+?|UK\s*\d{1,2}|TV-\w+|PG-?\d*|NC-?\d*|R|G)\]?)/i;
  const match = str.match(ratingRegex);

  if (match) {
    const tag = match[1].toUpperCase().replace(/\s+/g, "");
    if (tag.includes("18") || tag === "NC-17" || tag === "TV-MA" || tag === "R18") return "NC-17";
    if (tag.includes("15") || tag.includes("16") || tag === "R" || tag === "TV-14") return "R";
    if (tag.includes("12") || tag === "PG-13" || tag === "PG13") return "PG-13";
    if (tag.includes("7") || tag === "PG" || tag === "TV-PG") return "PG";
    if (tag === "G" || tag === "TV-Y" || tag === "TV-G") return "G";
  }
  return "UNRATED";
}
```

#### 2.4.2 `blockUnrated` Boolean Flag Specification
When `parentalControls.blockUnrated = true`:
- Any stream or item where rating metadata is missing, empty, or parses to `UNRATED` is filtered out of all catalog views.
- Direct stream playback calls verify rating parameters, preventing forced playback via deep link or search result.

#### 2.4.3 Adult Category (`group-title`) Lock Specification
IPTV channels frequently group adult channels into specific `group-title` or category names.
- **Adult Category Regex Pattern**: `/(?:xxx|adult|18\+|erotic|porno|nsfw|pink\s*light|playboy|brazzers)/i`
- **Lock Behavior**:
  1. Matching categories and items are automatically hidden when a Kids Profile is active.
  2. For non-Kids profiles with PIN protection enabled, opening an Adult Category triggers `PinVerificationModal`.
  3. Catalog items in locked adult groups display blur/lock overlays until PIN authentication passes for the active session.

### 2.5 PIN Security & Anti-Brute-Force Rate Limiting

- **Storage**: PINs are hashed using Web Crypto API SHA-256 (`crypto.subtle.digest("SHA-256", textEncoder.encode(pin))`) before saving to `localStorage`.
- **Lockout Policy**: Tracks consecutive failed verification attempts in memory.
  - 1st & 2nd Failed Attempts: Display red shake error notification.
  - 3rd Failed Attempt: Enforce a mandatory **30-second lockout timer** disabling PIN keypad input.

### 2.6 Namespaced Storage Isolation & Automatic Migration

- All profile settings are isolated under key pattern: `iptv_profile_{profileId}_settings`.
- Favorites: `iptv_profile_{profileId}_favorites`.
- Watch History: `iptv_profile_{profileId}_watch_history`.
- **Migration**: On initial boot, legacy `iptv_favorites_v1` and `iptv_watch_history_v1` entries are automatically migrated into the default Master Admin profile (`prof_admin`).

---

## 3. Feature 3: Offline Downloads Architecture (Hybrid Web Engine)

### 3.1 Competitive Parity (Plex Downloads & Jellyfin Sync)

- **Plex Parity**: Enables offline viewing of movies and episodes with full playback controls, quality tier selection, and automatic cleanup.
- **Jellyfin Parity**: Direct browser storage management, segment caching, and HTTP range streaming.

### 3.2 Dual Storage Engine Strategy

```
                          ┌──────────────────────────┐
                          │   IPTV Web Client        │
                          └────────────┬─────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            │                                                     │
            v                                                     v
┌───────────────────────────────┐     ┌─────────────────────────────────┐
│     Cache Storage API         │     │         IndexedDB Engine        │
│  (`iptv-offline-media-v1`)    │     │      (`iptv_downloads_db`)      │
├───────────────────────────────┤     ├─────────────────────────────────┤
│ - HLS `.ts` / `.m4s` segments │     │ - Download Queue Item Metadata  │
│ - Master `.m3u8` playlists    │     │ - Download Status & Progress    │
│ - Range-Header MP4 Chunks     │     │ - AES-128 DRM Keys & Tokens     │
└───────────────────────────────┘     └─────────────────────────────────┘
```

1. **Cache Storage API**: Handles binary video responses. `Response` objects are cached directly and served via Service Worker `fetch` event interception to HTML5 `<video>` elements without high-memory Blob URL generation.
2. **IndexedDB (`idb`)**: Stores `IDBDownloadItem` metadata, queue state machine, retry counts, and DRM decryption keys.

### 3.3 Technical Spec 3: Service Worker HTTP 206 Handler & HLS.js Custom Loader

#### 3.3.1 Service Worker HTTP 206 Partial Content Range Handler
HTML5 `<video>` elements rely on HTTP `206 Partial Content` with `Range` header support for seeking and buffered playback. The Service Worker intercepts requests matching `/offline-stream/`:

```javascript
// public/sw.js (Service Worker HTTP 206 Handler)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/offline-stream/')) {
    event.respondWith(handleOfflineStreamRangeRequest(event.request));
  }
});

async function handleOfflineStreamRangeRequest(request) {
  const cache = await caches.open('iptv-offline-media-v1');
  const cachedResponse = await cache.match(request.url);

  if (!cachedResponse) {
    return new Response('Offline Stream Not Found in Cache', { status: 404 });
  }

  const rangeHeader = request.headers.get('Range');
  if (!rangeHeader) {
    return cachedResponse;
  }

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const totalSize = arrayBuffer.byteLength;
  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

  const chunk = arrayBuffer.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunk.byteLength,
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/mp4',
    },
  });
}
```

#### 3.3.2 HLS.js Custom Offline Loader Plugin Spec (`OfflineHlsLoader`)
For HLS downloads, HLS.js is configured with a custom loader that checks Cache Storage before initiating network requests:

```typescript
import Hls from 'hls.js';

export class OfflineHlsLoader extends Hls.DefaultConfig.loader {
  constructor(config: any) {
    super(config);
  }

  load(context: Hls.LoaderContext, config: Hls.LoaderConfig, callbacks: Hls.LoaderCallbacks) {
    const cacheKey = context.url;
    caches.open('iptv-offline-media-v1').then((cache) => {
      cache.match(cacheKey).then((cachedResponse) => {
        if (cachedResponse) {
          cachedResponse.arrayBuffer().then((buffer) => {
            callbacks.onSuccess(
              { data: buffer, url: context.url },
              { trequest: performance.now(), tfirst: performance.now(), tload: performance.now() },
              context
            );
          });
        } else {
          // Fallback to standard network loader
          super.load(context, config, callbacks);
        }
      });
    });
  }
}
```

### 3.4 Quota Estimation & Session Token Renewal

- **Quota Inspection**: `navigator.storage.estimate()` monitors total disk quota vs used bytes.
- **Persisted Storage**: Requests `navigator.storage.persist()` on initial download request to prevent browser automatic cache eviction under disk pressure.
- **Token Renewal**: If an offline item's authorization token expires, background renewal sends `POST /api/proxy/player_api` when connectivity resumes to extend expiry by 7 days.

---

## 4. Feature 4: Advanced Content Filtering Architecture

### 4.1 Competitive Parity (Plex & Jellyfin Filter Facets)

- **Plex Parity**: Multi-faceted filtering by genre, year, resolution, rating, and watch status.
- **Jellyfin Parity**: Fast worker-indexed searching across massive channel and library catalogs.

### 4.2 Web Worker Offloaded Faceted Indexing (50,000+ Items)

```
 Main Thread (UI Keystroke / Pill Selection) 
       │
       │ postMessage({ type: 'APPLY_FILTERS', filters }, [transferableBuffer])
       v
 Dedicated Web Worker (`filter-worker.ts`)
 ├── Inverted N-Gram Search Index
 ├── Faceted Bitmask Maps (Genre, Rating, Year, Resolution, StreamType)
 └── Sorting Engine (< 12ms total processing)
       │
       │ postMessage({ type: 'FILTER_RESULTS', resultBuffer }, [resultBuffer])
       v
 Main Thread (Virtualized Grid Update via `@tanstack/react-virtual`)
```

### 4.3 Technical Spec 4: IPTV Metadata Facets & Zero-Copy `Transferable` ArrayBuffer Spec

#### 4.3.1 IPTV Metadata Facets Breakdown
The worker indexing engine extracts and indexes four primary IPTV metadata facets from raw M3U / Xtream responses:
1. **`group-title` / Category**: Provider category string (e.g. `US | Premium Movies`, `UK | Sports HD`).
2. **`streamType`**: Channel/media classification (`live` | `movie` / `vod` | `series`).
3. **`resolution`**: Stream quality tier parsed from stream names and video tags:
   - `4K`: matches `4K`, `UHD`, `2160P`
   - `1080p`: matches `1080P`, `FHD`, `FULL HD`
   - `720p`: matches `720P`, `HD`
4. **`hasEpg`**: Boolean flag indicating whether the channel has a valid `epg_channel_id` / `tvg-id` and active guide entries.

#### 4.3.2 Zero-Copy `Transferable` ArrayBuffer Spec
To process 50,000+ items without main thread allocation pauses or V8 structured clone serialization overhead:
- Filter indices and bitmask result arrays are represented as `Uint32Array` buffers.
- When transferring indices between Main Thread and Web Worker, the underlying `ArrayBuffer` is passed in the transfer list of `postMessage`:

```typescript
// Main Thread dispatch with Transferable ArrayBuffer
const itemIndexBuffer = new Uint32Array(catalogIds).buffer;
worker.postMessage(
  { type: 'INITIALIZE_INDEX', count: catalogIds.length, buffer: itemIndexBuffer },
  [itemIndexBuffer] // Zero-copy ownership transfer
);

// Web Worker return message
self.postMessage(
  { type: 'FILTER_RESULTS', matchedCount: matches.length, buffer: matches.buffer },
  [matches.buffer] // Zero-copy return
);
```

---

## 5. UI Prototype Structure & Phase 2 Integration

The Phase 2 UI prototype is implemented in `src/components/settings/SettingsShell.tsx`, `src/components/profiles/ProfileSelectorModal.tsx`, `src/components/filters/AdvancedFilterBar.tsx`, and `src/components/filters/QuickFilterPills.tsx`:

- **Themes & Customization Tab**: Live preset switcher (`dark-glass`, `oled-black`, `neon-cyber`, `classic-tivimate`), 6 accent color swatches, glassmorphism blur intensity selector (`none`, `sm`, `md`, `lg`), and anti-FOUC configuration toggle.
- **User Profiles & Parental Controls**: PIN verification modal, 4-digit numeric keypad, lockout timer, max allowed rating selector, `blockUnrated` toggle, and Adult category lock management.
- **Offline Downloads Management**: Storage quota visual progress gauge bar, active and completed download queue status badges, download speed indicator, auto-delete toggle, and quality limit selector.
- **Advanced Content Filtering**: Slide-out drawer with IPTV facets (`group-title`, `streamType`, `resolution`: 4K/1080p/720p, `hasEpg`), multi-select genre tags, dual release year slider, rating threshold, watch status, and sorting selectors.

---

## 6. Verification & Test Plan

1. **Compilation Verification**: Execute `npm run build` inside `iptv-nextjs` to confirm zero TypeScript compilation or linting errors.
2. **Dynamic Theme Test**: Select each theme preset (`dark-glass`, `oled-black`, `neon-cyber`, `classic-tivimate`) in Settings and verify CSS root variables mutate instantly without FOUC.
3. **Profile Isolation & Parental Lock Test**: Create a Kids Profile with max rating limit `PG`. Verify mature content (`R`, `NC-17`, `TV-MA`) is hidden. Attempt switching to Master Admin profile to verify 4-digit PIN lock and Adult Category lock.
4. **Offline Storage Test**: Inspect storage quota gauge and verify download items update queue state.
5. **Filter Performance Test**: Apply multiple combined filters (Category, Resolution 4K, Has EPG, Year Range) and verify instantaneous results update without UI stutter.
