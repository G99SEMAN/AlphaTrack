'use client'

import { useState, useMemo } from 'react'
import { Calculator, Info, TrendingUp, TrendingDown, Copy, Check } from 'lucide-react'

interface Instrument {
  pipSize: number
  lotUnits: number
  quoteCurrency: string
  decimals: number
}

const INSTRUMENTS: Record<string, Instrument> = {
  'EUR/USD': { pipSize: 0.0001, lotUnits: 100_000, quoteCurrency: 'USD', decimals: 5 },
  'GBP/USD': { pipSize: 0.0001, lotUnits: 100_000, quoteCurrency: 'USD', decimals: 5 },
  'AUD/USD': { pipSize: 0.0001, lotUnits: 100_000, quoteCurrency: 'USD', decimals: 5 },
  'NZD/USD': { pipSize: 0.0001, lotUnits: 100_000, quoteCurrency: 'USD', decimals: 5 },
  'USD/JPY': { pipSize: 0.01,   lotUnits: 100_000, quoteCurrency: 'JPY', decimals: 3 },
  'GBP/JPY': { pipSize: 0.01,   lotUnits: 100_000, quoteCurrency: 'JPY', decimals: 3 },
  'EUR/JPY': { pipSize: 0.01,   lotUnits: 100_000, quoteCurrency: 'JPY', decimals: 3 },
  'USD/CHF': { pipSize: 0.0001, lotUnits: 100_000, quoteCurrency: 'CHF', decimals: 5 },
  'EUR/CHF': { pipSize: 0.0001, lotUnits: 100_000, quoteCurrency: 'CHF', decimals: 5 },
  'USD/CAD': { pipSize: 0.0001, lotUnits: 100_000, quoteCurrency: 'CAD', decimals: 5 },
  'EUR/GBP': { pipSize: 0.0001, lotUnits: 100_000, quoteCurrency: 'GBP', decimals: 5 },
}

const ACCOUNT_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

function calcResult(
  instrument: Instrument,
  accountBalance: number,
  riskPercent: number,
  slPips: number,
  tpPips: number | null,
  entryPrice: number,
  accountCurrency: string,
  direction: 'long' | 'short',
) {
  if (!accountBalance || !riskPercent || !slPips || !entryPrice) return null

  const riskAmount = accountBalance * (riskPercent / 100)
  const pipValueInQuote = instrument.pipSize * instrument.lotUnits

  const quote = instrument.quoteCurrency
  let pipValueInAccount: number
  if (quote === accountCurrency) {
    pipValueInAccount = pipValueInQuote
  } else if (quote === 'USD') {
    pipValueInAccount = pipValueInQuote / entryPrice
  } else if (quote === 'JPY') {
    pipValueInAccount = pipValueInQuote / entryPrice
  } else {
    pipValueInAccount = pipValueInQuote
  }

  const lots = riskAmount / (slPips * pipValueInAccount)

  const slPrice = direction === 'long'
    ? entryPrice - slPips * instrument.pipSize
    : entryPrice + slPips * instrument.pipSize

  const tpPrice = tpPips !== null
    ? direction === 'long'
      ? entryPrice + tpPips * instrument.pipSize
      : entryPrice - tpPips * instrument.pipSize
    : null

  return {
    riskAmount,
    lots,
    miniLots: lots * 10,
    units: lots * instrument.lotUnits,
    slPrice,
    tpPrice,
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all group"
      style={{
        background: copied ? 'rgba(0,217,126,0.1)' : 'var(--surface-2)',
        border: `1.5px solid ${copied ? 'var(--green)' : 'var(--border)'}`,
      }}
    >
      <div className="text-left min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-3)' }}>
          {label}
        </p>
        <p
          className="text-xl font-bold font-mono leading-tight truncate"
          style={{ color: copied ? 'var(--green)' : 'var(--text-1)' }}
        >
          {value}
        </p>
      </div>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all"
        style={{
          background: copied ? 'var(--green)' : 'var(--surface-3)',
          color: copied ? '#fff' : 'var(--text-3)',
        }}
      >
        {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={15} />}
      </div>
    </button>
  )
}

export default function LotCalculator() {
  const [pair, setPair] = useState('EUR/USD')
  const [accountCurrency, setAccountCurrency] = useState('EUR')
  const [balance, setBalance] = useState('10000')
  const [riskPercent, setRiskPercent] = useState('1')
  const [slPips, setSlPips] = useState('20')
  const [tpPips, setTpPips] = useState('')
  const [price, setPrice] = useState('1.08500')
  const [direction, setDirection] = useState<'long' | 'short'>('long')

  const instrument = INSTRUMENTS[pair]

  const result = useMemo(() => calcResult(
    instrument,
    parseFloat(balance),
    parseFloat(riskPercent),
    parseFloat(slPips),
    tpPips ? parseFloat(tpPips) : null,
    parseFloat(price),
    accountCurrency,
    direction,
  ), [instrument, balance, riskPercent, slPips, tpPips, price, accountCurrency, direction])

  const inputClass = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all font-mono"
  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
  }
  const labelClass = "block text-xs font-semibold uppercase tracking-wide mb-1.5"

  return (
    <div className="flex flex-col gap-4">

      {/* Eingaben */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-bg)' }}>
            <Calculator size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Lot Size Rechner</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Forex - Standard Lots (100.000 Einheiten)</p>
          </div>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">

          {/* Pair + Kontowährung */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>Währungspaar</label>
              <select value={pair} onChange={e => setPair(e.target.value)} className={inputClass} style={{ ...inputStyle, cursor: 'pointer' }}>
                {Object.keys(INSTRUMENTS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>Kontowährung</label>
              <select value={accountCurrency} onChange={e => setAccountCurrency(e.target.value)} className={inputClass} style={{ ...inputStyle, cursor: 'pointer' }}>
                {ACCOUNT_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Richtung */}
          <div>
            <label className={labelClass} style={{ color: 'var(--text-3)' }}>Richtung</label>
            <div className="grid grid-cols-2 gap-2">
              {(['long', 'short'] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                  style={{
                    background: direction === d
                      ? d === 'long' ? 'rgba(0,217,126,0.15)' : 'rgba(255,69,96,0.15)'
                      : 'var(--surface-2)',
                    border: `1.5px solid ${direction === d
                      ? d === 'long' ? 'var(--green)' : 'var(--red)'
                      : 'var(--border)'}`,
                    color: direction === d
                      ? d === 'long' ? 'var(--green)' : 'var(--red)'
                      : 'var(--text-3)',
                  }}
                >
                  {d === 'long' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {d === 'long' ? 'Buy / Long' : 'Sell / Short'}
                </button>
              ))}
            </div>
          </div>

          {/* Kontogröße + Risiko */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>Kontogröße ({accountCurrency})</label>
              <input type="number" step="any" value={balance} onChange={e => setBalance(e.target.value)} placeholder="10000" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>Risiko in %</label>
              <input type="number" step="0.1" min="0.1" max="100" value={riskPercent} onChange={e => setRiskPercent(e.target.value)} placeholder="1" className={inputClass} style={inputStyle} />
              <div className="flex gap-1 mt-1.5">
                {['0.5', '1', '1.5', '2'].map(v => (
                  <button key={v} type="button" onClick={() => setRiskPercent(v)}
                    className="flex-1 py-1 rounded text-xs font-semibold cursor-pointer transition-all"
                    style={{
                      background: riskPercent === v ? 'var(--accent-bg)' : 'var(--surface-2)',
                      color: riskPercent === v ? 'var(--accent)' : 'var(--text-3)',
                      border: `1px solid ${riskPercent === v ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >{v}%</button>
                ))}
              </div>
            </div>
          </div>

          {/* Einstiegskurs + SL Pips + TP Pips */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>Einstiegskurs</label>
              <input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} placeholder="1.08500" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>SL (Pips)</label>
              <input type="number" step="1" min="1" value={slPips} onChange={e => setSlPips(e.target.value)} placeholder="20" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                TP (Pips) <span style={{ color: 'var(--text-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>optional</span>
              </label>
              <input type="number" step="1" min="1" value={tpPips} onChange={e => setTpPips(e.target.value)} placeholder="-" className={inputClass} style={inputStyle} />
            </div>
          </div>

        </div>

        {/* Risiko-Bar */}
        {result && (
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Risiko am Konto</p>
              <p className="text-xs font-bold" style={{ color: parseFloat(riskPercent) > 2 ? 'var(--red)' : parseFloat(riskPercent) > 1 ? '#f59e0b' : 'var(--green)' }}>
                {result.riskAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {accountCurrency} ({parseFloat(riskPercent).toFixed(1)}%)
              </p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(parseFloat(riskPercent) * 25, 100)}%`,
                background: parseFloat(riskPercent) > 2 ? 'var(--red)' : parseFloat(riskPercent) > 1 ? '#f59e0b' : 'var(--green)',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* MT5 Kopier-Panel */}
      {result ? (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* Header */}
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>MetaTrader 5 - Werte kopieren</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Klicke auf ein Feld um den Wert in die Zwischenablage zu kopieren</p>
            </div>
            <span
              className="text-xs px-2 py-1 rounded-md font-semibold"
              style={{ background: direction === 'long' ? 'rgba(0,217,126,0.12)' : 'rgba(255,69,96,0.12)', color: direction === 'long' ? 'var(--green)' : 'var(--red)' }}
            >
              {direction === 'long' ? 'Buy / Long' : 'Sell / Short'}
            </span>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {/* Volumen - wichtigster Wert */}
            <CopyButton
              label="Volumen (Lots)"
              value={result.lots.toFixed(2)}
            />

            <div className="grid grid-cols-2 gap-3">
              {/* Stop Loss Preis */}
              <CopyButton
                label="Stop Loss"
                value={result.slPrice.toFixed(instrument.decimals)}
              />

              {/* Take Profit Preis */}
              {result.tpPrice !== null ? (
                <CopyButton
                  label="Take Profit"
                  value={result.tpPrice.toFixed(instrument.decimals)}
                />
              ) : (
                <div
                  className="w-full flex flex-col items-center justify-center gap-1 px-4 py-3.5 rounded-xl"
                  style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Take Profit</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)', opacity: 0.6 }}>TP Pips eingeben</p>
                </div>
              )}
            </div>

            {/* Zusatzinfos */}
            <div className="grid grid-cols-2 gap-2 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              {[
                { label: 'Mini Lots', value: result.miniLots.toFixed(1) },
                { label: 'Einheiten', value: Math.round(result.units).toLocaleString('de-DE') },
              ].map(item => (
                <div key={item.label} className="px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{item.label}</p>
                  <p className="text-sm font-bold font-mono" style={{ color: 'var(--text-2)' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl flex items-center justify-center gap-2 py-8"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
        >
          <TrendingUp size={16} style={{ opacity: 0.4 }} />
          <p className="text-sm">Felder ausfüllen um MT5-Werte zu erhalten</p>
        </div>
      )}

      {/* Erklärung */}
      <div className="rounded-xl px-5 py-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>So verwendest du die Werte in MT5</p>
        </div>
        <ol className="flex flex-col gap-1.5">
          {[
            'Einstiegskurs, SL-Pips (und optional TP-Pips) eingeben',
            'Richtung wählen: Buy (Long) oder Sell (Short)',
            'Volumen kopieren → in MT5 ins Feld "Volumen" einfügen',
            'Stop Loss kopieren → in MT5 ins Feld "Stop Loss" einfügen',
            'Take Profit kopieren → in MT5 ins Feld "Take Profit" einfügen',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--text-2)' }}>
              <span
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

    </div>
  )
}
