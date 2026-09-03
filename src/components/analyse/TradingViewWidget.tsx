'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Duration } from './DurationSelector'

const TIMEFRAME: Record<Duration, string> = {
  scalping: '5',
  intraday: '60',
}

interface Props {
  duration: Duration
  theme: 'dark' | 'light'
  symbol?: string
}

export default function TradingViewWidget({ duration, theme, symbol = 'FX:EURUSD' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const locale = useLocale()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: TIMEFRAME[duration],
      timezone: 'Europe/Berlin',
      theme: theme,
      style: '1',
      locale: locale === 'en' ? 'en' : 'de_DE',
      allow_symbol_change: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    })

    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [duration, theme, symbol, locale])

  return (
    <div
      className="tradingview-widget-container rounded-xl overflow-hidden border"
      style={{ height: 460, borderColor: 'var(--border)' }}
    >
      <div ref={containerRef} className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
