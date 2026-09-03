'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Target } from 'lucide-react'
import { Strategy } from '@/types/strategy'
import { Trade } from '@/types/trade'
import StrategyCard from './StrategyCard'
import StrategyModal from './StrategyModal'
import StrategyDetailPanel from './StrategyDetailPanel'
import { useTranslations } from 'next-intl'

interface Props {
  strategies: Strategy[]
  trades: Trade[]
  currency: string
}

export default function StrategiesClient({ strategies, trades, currency }: Props) {
  const t = useTranslations('strategien.client')
  const [showModal, setShowModal] = useState(false)
  const [editStrategy, setEditStrategy] = useState<Strategy | null>(null)
  const [detailStrategyId, setDetailStrategyId] = useState<string | null>(null)

  const totalWithStrategy = trades.filter(t => t.strategyId && t.status === 'closed').length
  const totalClosed = trades.filter(t => t.status === 'closed').length

  const detailStrategy = detailStrategyId ? strategies.find(s => s.id === detailStrategyId) ?? null : null

  function openDetail(id: string) {
    setDetailStrategyId(id)
  }

  function closeDetail() {
    setDetailStrategyId(null)
  }

  function openEditFromDetail(strategy: Strategy) {
    setDetailStrategyId(null)
    setEditStrategy(strategy)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header-Leiste */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {strategies.length === 0
              ? t('noStrategiesYet')
              : t('summary', {
                  count: strategies.length,
                  countLabel: strategies.length === 1 ? t('countOne') : t('countMany'),
                  withStrategy: totalWithStrategy,
                  totalClosed,
                })
            }
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shrink-0"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        >
          <Plus size={15} />
          {t('newStrategyBtn')}
        </button>
      </div>

      {/* Leer-Zustand */}
      {strategies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-bg)' }}
          >
            <Target size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
              {t('emptyTitle')}
            </p>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-3)' }}>
              {t('emptyDescription')}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer mt-1"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={15} />
            {t('createFirstBtn')}
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {strategies.map((strategy, i) => (
            <motion.div
              key={strategy.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <StrategyCard
                strategy={strategy}
                trades={trades}
                currency={currency}
                onOpen={openDetail}
              />
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && <StrategyModal onClose={() => setShowModal(false)} />}
        {editStrategy && (
          <StrategyModal
            strategy={editStrategy}
            onClose={() => setEditStrategy(null)}
          />
        )}
        {detailStrategy && (
          <StrategyDetailPanel
            strategy={detailStrategy}
            trades={trades}
            currency={currency}
            onClose={closeDetail}
            onEdit={() => openEditFromDetail(detailStrategy)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
