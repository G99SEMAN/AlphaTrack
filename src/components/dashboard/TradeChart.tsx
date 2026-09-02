'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { createChart, IChartApi, LineStyle, UTCTimestamp, CandlestickData } from 'lightweight-charts'
import { Trade } from '@/types/trade'
import { mapToForexSymbol, computeChartWindow } from '@/lib/quotes'
import { useTranslations } from 'next-intl'

interface Props {
  trade: Trade
}

type ChartState = 'loading' | 'unsupported' | 'no-data' | 'error' | 'ready'

interface RawCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export default function TradeChart({ trade }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [state, setState] = useState<ChartState>('loading')
  const t = useTranslations('dashboard.tradeChart')
  const MESSAGES: Record<Exclude<ChartState, 'ready'>, string> = {
    loading: t('loading'),
    unsupported: t('unsupported'),
    'no-data': t('noData'),
    error: t('error'),
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const symbol = mapToForexSymbol(trade.instrument)
    if (!symbol) {
      setState('unsupported')
      return
    }
    if (!trade.closeTime) {
      setState('no-data')
      return
    }

    setState('loading')
    container.innerHTML = ''

    const win = computeChartWindow(trade.date, trade.closeTime)
    const url = `/api/quotes/history?symbol=${encodeURIComponent(symbol)}&interval=${win.interval}&start=${encodeURIComponent(win.start.toISOString())}&end=${encodeURIComponent(win.end.toISOString())}`

    let cancelled = false
    let chart: IChartApi | null = null

    const handleResize = () => {
      if (chart) chart.applyOptions({ width: container.clientWidth, height: container.clientHeight })
    }

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('request-failed')
        return res.json() as Promise<{ candles: RawCandle[] }>
      })
      .then(data => {
        if (cancelled) return
        if (!data.candles || data.candles.length === 0) {
          setState('no-data')
          return
        }

        const isDark = resolvedTheme === 'dark'
        chart = createChart(container, {
          width: container.clientWidth,
          height: container.clientHeight,
          layout: {
            background: { color: 'transparent' },
            textColor: isDark ? '#a1a1aa' : '#52525b',
          },
          grid: {
            vertLines: { color: isDark ? '#27272a' : '#e4e4e7' },
            horzLines: { color: isDark ? '#27272a' : '#e4e4e7' },
          },
          timeScale: { timeVisible: true, secondsVisible: false },
        })

        const series = chart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        })

        const candles: CandlestickData[] = data.candles.map(c => ({
          time: c.time as unknown as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        series.setData(candles)

        const entryTime = Math.floor(new Date(trade.date).getTime() / 1000) as unknown as UTCTimestamp
        const exitTime = Math.floor(new Date(trade.closeTime as string).getTime() / 1000) as unknown as UTCTimestamp

        series.setMarkers([
          {
            time: entryTime,
            position: trade.type === 'long' ? 'belowBar' : 'aboveBar',
            color: trade.type === 'long' ? '#22c55e' : '#f97316',
            shape: trade.type === 'long' ? 'arrowUp' : 'arrowDown',
            text: `Entry ${trade.entry}`,
          },
          {
            time: exitTime,
            position: trade.type === 'long' ? 'aboveBar' : 'belowBar',
            color: '#60a5fa',
            shape: 'circle',
            text: `Exit ${trade.exit ?? ''}`,
          },
        ])

        if (trade.sl != null) {
          series.createPriceLine({
            price: trade.sl,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'SL',
          })
        }
        if (trade.tp != null) {
          series.createPriceLine({
            price: trade.tp,
            color: '#22c55e',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'TP',
          })
        }

        chart.timeScale().fitContent()
        window.addEventListener('resize', handleResize)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)
      chart?.remove()
      chart = null
      container.innerHTML = ''
    }
  }, [trade, resolvedTheme])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {state !== 'ready' && (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 13, fontWeight: 600,
            textAlign: 'center', padding: 20,
          }}
        >
          {MESSAGES[state]}
        </div>
      )}
    </div>
  )
}
