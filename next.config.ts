import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['@react-pdf/renderer'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Bridge/Bots schreiben mehrmals pro Minute in data/, bridge/, bots/ (Heartbeat,
      // Trade-Sync, Logs) — ohne Ausschluss loest jeder Schreibvorgang eine Neukompilierung
      // aus, was im Dev-Server als Full-Reload ankommt und clientseitigen State zuruecksetzt
      // (z.B. Monatsauswahl im Dashboard-Kalender).
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.git/**', '**/data/**', '**/data-dev/**', '**/bridge/**', '**/bots/**'],
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
