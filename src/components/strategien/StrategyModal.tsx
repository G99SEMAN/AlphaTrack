'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Loader2, Check, Plus, Trash2 } from 'lucide-react'
import { Strategy, STRATEGY_COLORS, TIMEFRAME_KEYS, getTimeframeLabels, normalizeRules } from '@/types/strategy'
import { createStrategyAction, updateStrategyAction } from '@/lib/actions'
import { useTranslations } from 'next-intl'

interface Props {
  strategy?: Strategy
  onClose: () => void
}

const MIN_RULES = 3

function initRules(strategy?: Strategy): string[] {
  const existing = normalizeRules(strategy?.rules)
  if (existing.length >= MIN_RULES) return existing
  return [...existing, ...Array(MIN_RULES - existing.length).fill('')]
}

export default function StrategyModal({ strategy, onClose }: Props) {
  const t = useTranslations('strategien.modal')
  const timeframeLabels = getTimeframeLabels(useTranslations('strategien.timeframes'))
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [color, setColor] = useState(strategy?.color ?? STRATEGY_COLORS[0])
  const [ruleItems, setRuleItems] = useState<string[]>(() => initRules(strategy))
  const formRef = useRef<HTMLFormElement>(null)
  const isEdit = !!strategy

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  if (!mounted) return null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = formRef.current
    if (!form) return
    const fd = new FormData(form)
    fd.set('color', color)
    if (isEdit) fd.set('createdAt', strategy!.createdAt)

    const filledRules = ruleItems.filter(r => r.trim())
    fd.delete('rule')
    filledRules.forEach(r => fd.append('rule', r))

    setSaveError(null)
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateStrategyAction(strategy!.id, fd)
        } else {
          await createStrategyAction(fd)
        }
        onClose()
      } catch {
        setSaveError(t('saveError'))
      }
    })
  }

  function updateRule(index: number, value: string) {
    setRuleItems(prev => prev.map((r, i) => i === index ? value : r))
  }

  function addRule() {
    setRuleItems(prev => [...prev, ''])
  }

  function removeRule(index: number) {
    setRuleItems(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length < MIN_RULES ? [...next, ...Array(MIN_RULES - next.length).fill('')] : next
    })
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
  const inputStyle = {
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
  }
  const labelClass = "block text-xs font-semibold mb-1.5 uppercase tracking-wide"

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full my-auto"
        style={{ maxWidth: 520 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-t-xl"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
              {isEdit ? t('editTitle') : t('newTitle')}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {isEdit ? t('idLabel', { id: strategy!.id }) : t('createSubtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="rounded-b-xl"
          style={{ background: 'var(--surface)' }}
        >
          <div className="px-5 py-4 flex flex-col gap-4">

            {/* Name */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                {t('nameLabel')}
              </label>
              <input
                name="name"
                type="text"
                defaultValue={strategy?.name ?? ''}
                placeholder={t('namePlaceholder')}
                required
                className={inputClass}
                style={inputStyle}
              />
            </div>

            {/* Beschreibung */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                {t('descriptionLabel')}
              </label>
              <input
                name="description"
                type="text"
                defaultValue={strategy?.description ?? ''}
                placeholder={t('descriptionPlaceholder')}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            {/* Timeframe + Risiko */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  {t('timeframeLabel')}
                </label>
                <select
                  name="timeframe"
                  defaultValue={strategy?.timeframe ?? 'H1'}
                  required
                  className={inputClass}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {TIMEFRAME_KEYS.map(tf => (
                    <option key={tf} value={tf}>
                      {tf} - {timeframeLabels[tf]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                  {t('riskLabel')}
                </label>
                <div className="relative">
                  <input
                    name="riskPerTrade"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    defaultValue={strategy?.riskPerTrade ?? 1}
                    placeholder="1.0"
                    required
                    className={inputClass}
                    style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono"
                    style={{ color: 'var(--text-3)' }}
                  >
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Setup-Regeln */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass} style={{ color: 'var(--text-3)', marginBottom: 0 }}>
                  {t('rulesLabel')}
                </label>
                <button
                  type="button"
                  onClick={addRule}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer transition-all"
                  style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                >
                  <Plus size={11} />
                  {t('addRuleBtn')}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {ruleItems.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono w-5 text-right shrink-0"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      value={rule}
                      onChange={e => updateRule(index, e.target.value)}
                      placeholder={t('rulePlaceholder', { n: index + 1 })}
                      className={inputClass}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeRule(index)}
                      className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer shrink-0 transition-all"
                      style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,69,96,0.1)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notizen */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                {t('notesLabel')}
              </label>
              <textarea
                name="notes"
                defaultValue={strategy?.notes ?? ''}
                placeholder={t('notesPlaceholder')}
                rows={8}
                className={inputClass + ' resize-y'}
                style={inputStyle}
              />
            </div>

            {/* Farbe */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text-3)' }}>
                {t('colorLabel')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {STRATEGY_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer shrink-0"
                    style={{
                      background: c,
                      transform: color === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : 'none',
                    }}
                  >
                    {color === c && <Check size={13} color="#fff" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              {t('cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{
                background: isPending ? 'var(--accent-bg)' : 'var(--accent)',
                color: isPending ? 'var(--accent)' : '#fff',
                border: '1px solid var(--accent)',
              }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? t('saveBtn') : t('createBtn')}
            </button>
          </div>
          {saveError && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--red)' }}>{saveError}</p>
          )}
        </form>
      </motion.div>
    </div>,
    document.body
  )
}
