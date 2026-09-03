'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, AlertCircle, Zap, Loader2, Check, X, Wallet, Percent } from 'lucide-react'
import DurationSelector, { Duration } from './DurationSelector'
import TradingViewWidget from './TradingViewWidget'
import AnalysisResult from './AnalysisResult'
import AnalyseHistory from './AnalyseHistory'
import { AnalyseResult } from '@/app/api/analyse/route'
import { AnalyseHistoryEntry } from '@/lib/analyse-data'
import { BotEntry } from '@/types/bot'
import { useTradingLock } from '@/context/TradingLockContext'
import { useTranslations, useLocale } from 'next-intl'

interface Props {
  bots?: BotEntry[]
}

interface AccountInfo {
  balance: number
  currency: string
}

const CURRENCY_PAIRS = [
  { label: 'EUR/USD', apiSymbol: 'EUR/USD', tvSymbol: 'FX:EURUSD', botSymbol: 'EURUSDp', decimals: 5 },
  { label: 'GBP/USD', apiSymbol: 'GBP/USD', tvSymbol: 'FX:GBPUSD', botSymbol: 'GBPUSDp', decimals: 5 },
  { label: 'USD/JPY', apiSymbol: 'USD/JPY', tvSymbol: 'FX:USDJPY', botSymbol: 'USDJPYp', decimals: 3 },
  { label: 'USD/CHF', apiSymbol: 'USD/CHF', tvSymbol: 'FX:USDCHF', botSymbol: 'USDCHFp', decimals: 5 },
  { label: 'AUD/USD', apiSymbol: 'AUD/USD', tvSymbol: 'FX:AUDUSD', botSymbol: 'AUDUSDp', decimals: 5 },
  { label: 'NZD/USD', apiSymbol: 'NZD/USD', tvSymbol: 'FX:NZDUSD', botSymbol: 'NZDUSDp', decimals: 5 },
  { label: 'USD/CAD', apiSymbol: 'USD/CAD', tvSymbol: 'FX:USDCAD', botSymbol: 'USDCADp', decimals: 5 },
  { label: 'EUR/GBP', apiSymbol: 'EUR/GBP', tvSymbol: 'FX:EURGBP', botSymbol: 'EURGBPp', decimals: 5 },
]

function parsePrice(s: string): number {
  const parts = s.match(/[\d.]+/g)
  if (!parts || parts.length === 0) return 0
  if (parts.length === 1) return parseFloat(parts[0])
  return (parseFloat(parts[0]) + parseFloat(parts[parts.length - 1])) / 2
}

function calcLotSize(
  balance: number,
  riskPct: number,
  entryZone: string,
  stopLoss: string,
  decimals: number,
): { lots: number; riskAmount: number; slPips: number } | null {
  const entry = parsePrice(entryZone)
  const sl = parsePrice(stopLoss)
  if (!entry || !sl || entry === sl) return null

  const slDistance = Math.abs(entry - sl)
  const pipSize = decimals === 3 ? 0.01 : 0.0001
  const slPips = Math.round(slDistance / pipSize)
  if (slPips <= 0) return null

  // Pip-Wert pro Standard-Lot in Kontowährung (vereinfacht)
  // JPY-Paare: ~1000/rate, alle anderen: ~10
  const pipValue = decimals === 3 ? (1000 / entry) : 10

  const riskAmount = balance * riskPct / 100
  const lots = riskAmount / (slPips * pipValue)
  const rounded = Math.max(0.01, Math.round(lots * 100) / 100)

  return { lots: rounded, riskAmount: Math.round(riskAmount * 100) / 100, slPips }
}

export default function AnalyseClient({ bots = [] }: Props) {
  const t = useTranslations('analyse.client')
  const locale = useLocale()
  const { isUnlocked } = useTradingLock()
  const { resolvedTheme } = useTheme()
  const [duration, setDuration] = useState<Duration>('scalping')
  const [pair, setPair] = useState(CURRENCY_PAIRS[0])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<(AnalyseResult & { currentPrice?: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Account-Info vom Bot
  const [account, setAccount] = useState<AccountInfo | null>(null)
  useEffect(() => {
    if (!bots[0]?.id) return
    fetch(`/api/bridge/status?bridgeId=${bots[0].id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.status?.balance != null) {
          setAccount({ balance: d.status.balance, currency: d.status.currency ?? 'USD' })
        }
      })
      .catch(() => {})
  }, [bots])

  // Risk-Management
  const [riskPct, setRiskPct] = useState('1')
  const [lotCalc, setLotCalc] = useState<{ lots: number; riskAmount: number; slPips: number } | null>(null)

  // History
  const [history, setHistory] = useState<AnalyseHistoryEntry[]>([])

  useEffect(() => {
    fetch('/api/analyse/history')
      .then(r => r.ok ? r.json() : { history: [] })
      .then(d => setHistory(d.history ?? []))
      .catch(() => {})
  }, [])

  // Bot-Senden State
  const [sendBotId, setSendBotId] = useState<string>(bots[0]?.id ?? '')
  const [sendLots, setSendLots] = useState('0.01')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; msg: string } | null>(null)

  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const canSendToBot = bots.length > 0 && result && result.bias !== 'Neutral'

  async function handleAnalyse() {
    setLoading(true)
    setError(null)
    setResult(null)
    setSendResult(null)
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, symbol: pair.apiSymbol, lang: locale }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error ?? t('analysisFailedFallback'))
      }
      const data: AnalyseResult = await res.json()
      setResult(data)

      // Lotsize automatisch berechnen wenn Balance vorhanden
      if (account && data.entry_zone && data.stop_loss) {
        const calc = calcLotSize(account.balance, parseFloat(riskPct) || 1, data.entry_zone, data.stop_loss, pair.decimals)
        if (calc) {
          setLotCalc(calc)
          setSendLots(String(calc.lots))
        }
      }

      // In History speichern
      fetch('/api/analyse/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, duration, symbol: pair.apiSymbol }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.entry) setHistory(prev => [d.entry, ...prev].slice(0, 10))
        })
        .catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fetchFailedFallback'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSendToBot() {
    if (!result || !sendBotId) return
    setSending(true)
    setSendResult(null)

    const direction = result.bias === 'Long' ? 'buy' : 'sell'
    const sl = parsePrice(result.stop_loss)
    const tp = parsePrice(result.take_profit)
    const lots = parseFloat(sendLots)

    try {
      const res = await fetch('/api/bridge/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bridgeId: sendBotId,
          command: 'execute_trade',
          payload: {
            symbol: pair.botSymbol,
            direction,
            lots,
            ...(sl > 0 ? { sl } : {}),
            ...(tp > 0 ? { tp } : {}),
          },
        }),
      })
      const data = await res.json()
      if (res.ok && (data.ok || data.result?.success)) {
        const ticket = data.result?.ticket
        setSendResult({ success: true, msg: `${t('tradeExecutedMsg')}${ticket ? ` ${t('ticketSuffix', { ticket })}` : ''}` })
      } else {
        setSendResult({ success: false, msg: data.result?.error ?? data.error ?? t('executeErrorFallback') })
      }
    } catch {
      setSendResult({ success: false, msg: t('networkErrorMsg') })
    }
    setSending(false)
  }

  function handleDurationChange(d: Duration) {
    setDuration(d)
    setResult(null)
    setError(null)
    setSendResult(null)
    setLotCalc(null)
  }

  function handlePairChange(p: typeof CURRENCY_PAIRS[0]) {
    setPair(p)
    setResult(null)
    setError(null)
    setSendResult(null)
    setLotCalc(null)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Währungspaar-Auswahl */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {t('currencyPairLabel')}
        </p>
        <div className="flex flex-wrap gap-2">
          {CURRENCY_PAIRS.map(p => (
            <button
              key={p.apiSymbol}
              onClick={() => handlePairChange(p)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={pair.apiSymbol === p.apiSymbol ? {
                background: 'var(--accent)',
                color: 'var(--accent-fg, #fff)',
              } : {
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dauer-Auswahl */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {t('durationLabel')}
        </p>
        <DurationSelector value={duration} onChange={handleDurationChange} disabled={loading} />
      </div>

      {/* Chart */}
      <TradingViewWidget duration={duration} theme={theme} symbol={pair.tvSymbol} />

      {/* Risk-Management */}
      {bots.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={13} style={{ color: 'var(--text-3)' }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              {t('riskManagementLabel')}
            </p>
            {account && (
              <span className="ml-auto text-xs font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                {account.balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.currency}
              </span>
            )}
            {!account && (
              <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>{t('balanceUnavailable')}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <Percent size={13} style={{ color: 'var(--text-3)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>{t('riskLabel')}</span>
              <input
                type="number" min="0.1" max="10" step="0.1"
                value={riskPct}
                onChange={e => setRiskPct(e.target.value)}
                className="w-16 text-right text-sm font-bold font-mono outline-none bg-transparent"
                style={{ color: 'var(--text-1)' }}
              />
              <span className="text-sm font-bold" style={{ color: 'var(--text-2)' }}>%</span>
            </div>
            {account && (
              <div className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                ={' '}
                <span className="font-bold" style={{ color: 'var(--text-2)' }}>
                  {(account.balance * (parseFloat(riskPct) || 1) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.currency}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analyse-Button */}
      <button
        onClick={handleAnalyse}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full md:w-auto md:self-start px-6 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: 'var(--accent)', color: 'var(--accent-fg, #fff)' }}
      >
        {loading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            />
            {t('analyzingBtn')}
          </>
        ) : (
          <>
            <Sparkles size={15} />
            {t('startAnalysisBtn')}
          </>
        )}
      </button>

      {/* Fehler */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
          >
            <AlertCircle size={16} className="shrink-0" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ergebnis */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            <AnalysisResult result={result} />

            {/* An Bot senden */}
            {canSendToBot && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <Zap size={15} style={{ color: '#ef4444' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{t('sendToBotHeading')}</p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {result.bias === 'Long' ? 'BUY' : 'SELL'} {pair.botSymbol}
                      {parsePrice(result.stop_loss) > 0 && ` · SL ${parsePrice(result.stop_loss).toFixed(pair.decimals)}`}
                      {parsePrice(result.take_profit) > 0 && ` · TP ${parsePrice(result.take_profit).toFixed(pair.decimals)}`}
                    </p>
                  </div>
                </div>

                {/* Lotsize-Berechnung Info */}
                {lotCalc && account && (
                  <div className="mb-4 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 flex-wrap"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <Percent size={12} style={{ color: '#ef4444' }} />
                    <span style={{ color: 'var(--text-2)' }}>
                      <span className="font-bold" style={{ color: '#ef4444' }}>{riskPct}% {t('riskLabel')}</span>
                      {' = '}
                      <span className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                        {lotCalc.riskAmount.toFixed(2)} {account.currency}
                      </span>
                      {' '}{t('atLabel')}{' '}
                      <span className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                        {lotCalc.slPips} Pips SL
                      </span>
                      {' → '}
                      <span className="font-mono font-bold" style={{ color: '#ef4444' }}>
                        {lotCalc.lots} Lots
                      </span>
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Bot-Auswahl */}
                  {bots.length > 1 && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>{t('botLabel')}</label>
                      <select
                        value={sendBotId}
                        onChange={e => setSendBotId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                      >
                        {bots.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Lots */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>
                      {t('lotSizeLabel')}
                      {lotCalc && <span className="ml-1 font-normal" style={{ color: 'var(--text-3)' }}>{t('calculatedSuffix')}</span>}
                    </label>
                    <input
                      type="number" step="0.01" min="0.01" max="100"
                      value={sendLots}
                      onChange={e => setSendLots(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendToBot}
                  disabled={sending || !isUnlocked}
                  title={!isUnlocked ? t('unlockToSendTooltip') : undefined}
                  className="w-full py-3 rounded-xl text-sm font-black tracking-wider cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: result.bias === 'Long'
                      ? 'linear-gradient(135deg, #16a34a, #15803d)'
                      : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: '#fff',
                    boxShadow: result.bias === 'Long'
                      ? '0 4px 20px rgba(34,197,94,0.3)'
                      : '0 4px 20px rgba(239,68,68,0.3)',
                  }}
                >
                  {sending
                    ? <><Loader2 size={15} className="animate-spin" /> {t('sendingBtn')}</>
                    : <><Zap size={15} /> {result.bias === 'Long' ? 'BUY' : 'SELL'} {sendLots} {pair.botSymbol} {t('executeBtnSuffix')}</>
                  }
                </button>

                {/* Ergebnis-Feedback */}
                <AnimatePresence>
                  {sendResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold"
                      style={{
                        background: sendResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${sendResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        color: sendResult.success ? '#22c55e' : '#ef4444',
                      }}>
                      {sendResult.success ? <Check size={13} /> : <X size={13} />}
                      {sendResult.msg}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <AnalyseHistory entries={history} />
        </motion.div>
      )}
    </div>
  )
}
