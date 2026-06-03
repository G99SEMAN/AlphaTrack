'use client'

import NetworkDiagram from '@/components/bridge/NetworkDiagramFull'

export default function NetzwerkClient() {
  return (
    <main className="flex-1 overflow-auto p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
          Netzwerk
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
          Live-Übersicht aller Verbindungen — aktualisiert automatisch alle 5 Sekunden
        </p>
      </div>
      <NetworkDiagram />
    </main>
  )
}
