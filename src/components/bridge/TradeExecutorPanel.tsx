'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, ChevronDown, ChevronUp, Check, AlertCircle, Loader2, ShieldOff } from 'lucide-react'
import { ConnectionState, BotState, TradeOrderResult } from '@/types/bot'
import { useTradingLock } from '@/context/TradingLockContext'
import { useTranslations } from 'next-intl'

interface Props {
  botId: string
  connectionState?: ConnectionState
  botState?: BotState
  activeSymbols?: string[]
}

const FALLBACK_SYMBOLS = ['EURUSDp', 'GBPUSDp', 'XAUUSDp', 'USDJPYp', 'GBPJPYp', 'EURJPYp']
const LOT_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]

export default function TradeExecutorPanel({ botId, connectionState, botState, activeSymbols }: Props) {
  const t = useTranslations('bridge.executor')
  const { isUnlocked } = useTradingLock()
  const [symbol, setSymbol] = useState('')
  const [customSymbol, setCustomSymbol] = useState('')
  const [direction, setDirection] = useState<'buy' | 'sell' | null>(null)
  const [lots, setLots] = useState('0.01')
  const [showSlTp, setShowSlTp] = useState(false)
  const [slTpMode, setSlTpMode] = useState<'price' | 'pips'>('price')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [lastResult, setLastResult] = useState<TradeOrderResult | null>(null)

  const symbols = activeSymbols && activeSymbols.length > 0 ? activeSymbols : FALLBACK_SYMBOLS
  const effectiveSymbol = symbol === '__custom__' ? customSymbol.trim() : symbol
  const isOffline = !connectionState || connectionState === 'offline'
  const isNotRunning = !botState || botState === 'stopped' || botState === 'error' || botState === 'disconnected'
  const disabled = !isUnlocked || isOffline || isNotRunning || status === 'loading'

  const lotsNum = parseFloat(lots)
  const isValid = effectiveSymbol.length >= 3 && direction !== null && !isNaN(lotsNum) && lotsNum > 0 && lotsNum <= 100

  async function executeTrade() {
    if (!isValid || disabled) return
    setStatus('loading')
    setLastResult(null)
    try {
      const payload: Record<string, unknown> = {
        symbol: effectiveSymbol,
        direction,
        lots: lotsNum,
      }
      if (sl && parseFloat(sl) > 0) {
        if (slTpMode === 'pips') payload.slPips = parseFloat(sl)
        else payload.sl = parseFloat(sl)
      }
      if (tp && parseFloat(tp) > 0) {
        if (slTpMode === 'pips') payload.tpPips = parseFloat(tp)
        else payload.tp = parseFloat(tp)
      }

      const res = await fetch('/api/bridge/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridgeId: botId, command: 'execute_trade', payload }),
      })
      const data = await res.json()

      if (res.ok) {
        const result: TradeOrderResult = data.result ?? {
          success: true,
          symbol: effectiveSymbol,
          direction: direction!,
          lots: lotsNum,
          timestamp: new Date().toISOString(),
        }
        setLastResult(result)
        setStatus(result.success ? 'success' : 'error')
      } else {
        setLastResult({
          success: false,
          error: data.error ?? t('unknownErrorLong'),
          symbol: effectiveSymbol,
          direction: direction!,
          lots: lotsNum,
          timestamp: new Date().toISOString(),
        })
        setStatus('error')
      }
    } catch (e) {
      setLastResult({
        success: false,
        error: t('networkError'),
        symbol: effectiveSymbol,
        direction: direction!,
        lots: lotsNum,
        timestamp: new Date().toISOString(),
      })
      setStatus('error')
    }

    setTimeout(() => setStatus('idle'), 5000)
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <Zap size={15} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{t('heading')}</h3>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{t('subtitle')}</p>
        </div>
        {!isUnlocked ? (
          <span className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <ShieldOff size={11} /> {t('tradingLocked')}
          </span>
        ) : (isOffline || isNotRunning) && (
          <span className="ml-auto text-xs px-2 py-1 rounded-lg font-semibold"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {isOffline ? t('botOffline') : t('botNotActive')}
          </span>
        )}
      </div>

      {/* Symbol */}
      <div className="mb-4">
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>{t('symbolLabel')}</label>
        <div className="flex flex-wrap gap-1.5">
          {symbols.map(s => (
            <button key={s} onClick={() => { setSymbol(s); setCustomSymbol('') }}
              disabled={disabled}
              className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: symbol === s ? 'rgba(239,68,68,0.15)' : 'var(--bg)',
                border: symbol === s ? '1px solid rgba(239,68,68,0.5)' : '1px solid var(--border)',
                color: symbol === s ? '#ef4444' : 'var(--text-2)',
              }}>
              {s}
            </button>
          ))}
          <button onClick={() => setSymbol('__custom__')}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: symbol === '__custom__' ? 'rgba(239,68,68,0.15)' : 'var(--bg)',
              border: symbol === '__custom__' ? '1px solid rgba(239,68,68,0.5)' : '1px solid var(--border)',
              color: symbol === '__custom__' ? '#ef4444' : 'var(--text-2)',
            }}>
            {t('manualBtn')}
          </button>
        </div>
        {symbol === '__custom__' && (
          <input
            type="text"
            value={customSymbol}
            onChange={e => setCustomSymbol(e.target.value)}
            placeholder={t('customSymbolPlaceholder')}
            disabled={disabled}
            className="mt-2 w-full px-3 py-2 rounded-xl text-sm font-mono outline-none disabled:opacity-40"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        )}
      </div>

      {/* Direction */}
      <div className="mb-4">
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>{t('directionLabel')}</label>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setDirection('buy')}
            disabled={disabled}
            className="py-3 rounded-xl text-sm font-black cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed tracking-wider"
            style={{
              background: direction === 'buy' ? 'rgba(34,197,94,0.2)' : 'var(--bg)',
              border: direction === 'buy' ? '1px solid rgba(34,197,94,0.6)' : '1px solid var(--border)',
              color: direction === 'buy' ? '#22c55e' : 'var(--text-3)',
            }}>
            BUY
          </button>
          <button onClick={() => setDirection('sell')}
            disabled={disabled}
            className="py-3 rounded-xl text-sm font-black cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed tracking-wider"
            style={{
              background: direction === 'sell' ? 'rgba(239,68,68,0.2)' : 'var(--bg)',
              border: direction === 'sell' ? '1px solid rgba(239,68,68,0.6)' : '1px solid var(--border)',
              color: direction === 'sell' ? '#ef4444' : 'var(--text-3)',
            }}>
            SELL
          </button>
        </div>
      </div>

      {/* Lot Size */}
      <div className="mb-4">
        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>
          {t('lotSizeLabel')}
          <span className="ml-2 font-normal" style={{ color: 'var(--text-3)' }}>
            ({lotsNum > 0 ? `${lotsNum} ${t('lotUnit')}` : t('invalidLabel')})
          </span>
        </label>
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {LOT_PRESETS.map(p => (
            <button key={p} onClick={() => setLots(String(p))}
              disabled={disabled}
              className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: lots === String(p) ? 'rgba(239,68,68,0.15)' : 'var(--bg)',
                border: lots === String(p) ? '1px solid rgba(239,68,68,0.5)' : '1px solid var(--border)',
                color: lots === String(p) ? '#ef4444' : 'var(--text-2)',
              }}>
              {p}
            </button>
          ))}
        </div>
        <input
          type="number" step="0.01" min="0.01" max="100"
          value={lots}
          onChange={e => setLots(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none disabled:opacity-40"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        />
      </div>

      {/* SL / TP Toggle */}
      <button onClick={() => setShowSlTp(v => !v)} disabled={disabled}
        className="flex items-center gap-1.5 text-xs font-semibold mb-3 cursor-pointer opacity-70 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
        style={{ color: 'var(--text-3)' }}>
        {showSlTp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {t('slTpToggle')}
      </button>

      <AnimatePresence>
        {showSlTp && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">

            {/* Modus-Toggle */}
            <div className="flex gap-1.5 mb-3">
              {(['price', 'pips'] as const).map(mode => (
                <button key={mode} onClick={() => { setSlTpMode(mode); setSl(''); setTp('') }}
                  disabled={disabled}
                  className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: slTpMode === mode ? 'rgba(239,68,68,0.15)' : 'var(--bg)',
                    border: slTpMode === mode ? '1px solid rgba(239,68,68,0.5)' : '1px solid var(--border)',
                    color: slTpMode === mode ? '#ef4444' : 'var(--text-3)',
                  }}>
                  {mode === 'price' ? t('modePrice') : t('modePips')}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>
                  {t('slLabel')} {slTpMode === 'pips' ? t('pipsUnit') : t('priceUnit')}
                </label>
                <input
                  type="number"
                  step={slTpMode === 'pips' ? '1' : '0.00001'}
                  min="0"
                  value={sl}
                  onChange={e => setSl(e.target.value)}
                  placeholder={slTpMode === 'pips' ? t('slPlaceholderPips') : t('slPlaceholderPrice')}
                  disabled={disabled}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none disabled:opacity-40"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>
                  {t('tpLabel')} {slTpMode === 'pips' ? t('pipsUnit') : t('priceUnit')}
                </label>
                <input
                  type="number"
                  step={slTpMode === 'pips' ? '1' : '0.00001'}
                  min="0"
                  value={tp}
                  onChange={e => setTp(e.target.value)}
                  placeholder={slTpMode === 'pips' ? t('tpPlaceholderPips') : t('tpPlaceholderPrice')}
                  disabled={disabled}
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none disabled:opacity-40"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execute Button */}
      <button onClick={executeTrade}
        disabled={disabled || !isValid}
        className="w-full py-3.5 rounded-xl text-sm font-black tracking-wider cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{
          background: direction === 'sell'
            ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
            : direction === 'buy'
              ? 'linear-gradient(135deg, #16a34a, #15803d)'
              : 'var(--bg)',
          border: direction ? 'none' : '1px solid var(--border)',
          color: direction ? '#fff' : 'var(--text-3)',
          boxShadow: direction && !disabled && isValid
            ? direction === 'buy' ? '0 4px 20px rgba(34,197,94,0.3)' : '0 4px 20px rgba(239,68,68,0.3)'
            : 'none',
        }}>
        {status === 'loading' ? (
          <><Loader2 size={15} className="animate-spin" /> {t('executing')}</>
        ) : (
          <><Zap size={15} />
            {direction && effectiveSymbol
              ? `${direction.toUpperCase()} ${lotsNum} ${effectiveSymbol}`
              : t('executeTradeBtn')}
          </>
        )}
      </button>

      {/* Ergebnis */}
      <AnimatePresence>
        {lastResult && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 px-4 py-3 rounded-xl flex items-start gap-3"
            style={{
              background: lastResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${lastResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
            {lastResult.success
              ? <Check size={15} className="shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
              : <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: '#ef4444' }} />}
            <div className="min-w-0">
              {lastResult.success ? (
                <p className="text-xs font-bold" style={{ color: '#22c55e' }}>
                  {t('orderExecuted')}{lastResult.ticket ? ` ${t('orderTicket', { ticket: lastResult.ticket })}` : ''}
                </p>
              ) : (
                <p className="text-xs font-bold" style={{ color: '#ef4444' }}>
                  {t('errorPrefix')} {lastResult.error ?? t('unknownError')}
                </p>
              )}
              <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-3)' }}>
                {lastResult.direction?.toUpperCase()} {lastResult.lots} {lastResult.symbol}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
