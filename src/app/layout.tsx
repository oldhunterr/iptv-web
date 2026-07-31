import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPTV Web Application",
  description: "Next.js IPTV Web Application with Dynamic Themes, User Profiles, and Advanced Filtering",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = localStorage.getItem('iptv_theme_config') || localStorage.getItem('iptv_theme_settings_v1');
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
      </head>
      <body className="antialiased bg-slate-900 text-slate-100 min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
