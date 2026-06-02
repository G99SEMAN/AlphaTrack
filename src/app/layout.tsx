import type { Metadata, Viewport } from 'next'
import { Outfit, DM_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import SplashScreen from '@/components/layout/SplashScreen'
import SwRegister from '@/components/layout/SwRegister'
import { TradingLockProvider } from '@/context/TradingLockContext'
import { BotStatusProvider } from '@/context/BotStatusContext'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#080b12',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'AlphaTrack',
  description: 'Dein persönliches Trading Journal',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AlphaTrack',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('alphatrack-accent-theme');if(t==='red')document.documentElement.classList.add('theme-red');if(t==='violet')document.documentElement.classList.add('theme-violet');})();` }} />
      </head>
      <body
        className={`${outfit.variable} ${dmMono.variable}`}
        style={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif' }}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <TradingLockProvider>
            <BotStatusProvider>
              <SplashScreen />
              {children}
            </BotStatusProvider>
          </TradingLockProvider>
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  )
}
