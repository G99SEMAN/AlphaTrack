'use client'

import { Monitor, Cpu, Globe } from 'lucide-react'
import { useBotStatus } from '@/context/BotStatusContext'

type NodeStatus = 'online' | 'warning' | 'offline'

const STATUS_COLOR: Record<NodeStatus, string> = {
  online:  '#00d97e',
  warning: '#f59e0b',
  offline: '#ef4444',
}

function SmallNode({ icon: Icon, label, status, color }: {
  icon: React.ElementType
  label: string
  status: NodeStatus
  color: string
}) {
  const dot = STATUS_COLOR[status]
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 44 }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: `${color}14`, border: `1px solid ${color}28` }}>
        <Icon size={13} style={{ color }} />
      </div>
      <p className="text-[9px] font-semibold leading-none text-center" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>
      <span className="rounded-full"
        style={{
          width: 5, height: 5, display: 'block',
          background: dot,
          boxShadow: status === 'online' ? `0 0 4px ${dot}` : 'none',
        }}
      />
    </div>
  )
}

function SmallLine({ status }: { status: NodeStatus }) {
  const active = status !== 'offline'
  const color = STATUS_COLOR[status]
  return (
    <div className="flex items-center gap-0.5 pb-5" style={{ width: 32 }}>
      <div className="relative h-px overflow-visible" style={{ width: 24 }}>
        <div className="absolute inset-0 rounded-full"
          style={{ background: active ? `${color}40` : 'var(--border)' }} />
        {active && (
          <span className="bridge-flow-dot absolute top-1/2 -translate-y-1/2 rounded-full"
            style={{ width: 5, height: 5, background: color, boxShadow: `0 0 4px ${color}` }} />
        )}
      </div>
      <svg width={6} height={10} viewBox="0 0 6 10">
        <polyline points="1,1 5,5 1,9"
          stroke={active ? color : 'var(--border)'}
          strokeWidth={1.2} fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function SidebarBridgeStatus() {
  const { bots } = useBotStatus()

  const best = bots.find(b => b.status?.connectionState === 'connected')?.status
    ?? bots.find(b => b.status?.connectionState === 'warning')?.status
    ?? bots.find(b => b.status)?.status
    ?? null

  const bridgeStatus: NodeStatus = !best ? 'offline'
    : best.connectionState === 'connected' ? 'online'
    : best.connectionState === 'warning' ? 'warning'
    : 'offline'

  const mt5Status: NodeStatus = !best || bridgeStatus === 'offline' ? 'offline'
    : best.mt5Connected ? 'online'
    : 'warning'

  return (
    <div className="rounded-xl px-3 py-2.5"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <p className="text-[9px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--text-3)' }}>
        Verbindung
      </p>
      <div className="flex items-center justify-between">
        <SmallNode icon={Monitor} label="MT5"     status={mt5Status}    color="#60a5fa" />
        <SmallLine status={bridgeStatus} />
        <SmallNode icon={Cpu}     label="Bridge"  status={bridgeStatus} color="#a855f7" />
        <SmallLine status={bridgeStatus} />
        <SmallNode icon={Globe}   label="Alpha"   status="online"       color="#00d97e" />
      </div>
    </div>
  )
}
