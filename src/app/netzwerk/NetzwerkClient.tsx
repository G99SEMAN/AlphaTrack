'use client'

import NetworkDiagram from '@/components/bridge/NetworkDiagramFull'
import { useTranslations } from 'next-intl'

export default function NetzwerkClient() {
  const t = useTranslations('netzwerk.page')
  return (
    <main className="flex-1 overflow-auto p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
          {t('title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
          {t('subtitle')}
        </p>
      </div>
      <NetworkDiagram />
    </main>
  )
}
