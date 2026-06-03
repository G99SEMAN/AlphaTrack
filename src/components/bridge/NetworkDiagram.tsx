'use client'

import { Monitor, Cpu, Globe, Bot as BotIcon } from 'lucide-react'
import { useBotStatus } from '@/context/BotStatusContext'
import type { BotWithStatus } from '@/types/bot'

type Status = 'online' | 'warning' | 'offline'

const STATUS_COLOR: Record<Status, string> = {
  online:  '#00d97e',
  warning: '#f59e0b',
  offline: '#ef4444',
}

const ACCENT = {
  at:     '#00d97e',
  bridge: '#a855f7',
  mt5:    '#60a5fa',
  bot:    '#f59e0b',
}

function resolveStatus(bw: BotWithStatus | null | undefined): Status {
  if (!bw?.status) return 'offline'
  const cs = bw.status.connectionState
  return cs === 'connected' ? 'online' : cs === 'warning' ? 'warning' : 'offline'
}

function NetNode({ left, top, icon: Icon, label, status, accent }: {
  left: number; top: number; icon: React.ElementType
  label: string; status: Status; accent: string
}) {
  const dot = STATUS_COLOR[status]
  return (
    <div style={{ position: 'absolute', left, top, width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `${accent}15`, border: `1px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={12} color={accent} />
      </div>
      <span style={{
        fontSize: 8, fontWeight: 700, lineHeight: 1,
        color: 'var(--text-3)', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 40,
      }}>
        {label}
      </span>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', display: 'block',
        background: dot,
        boxShadow: status === 'online' ? `0 0 5px ${dot}` : 'none',
      }} />
    </div>
  )
}

function Edge({ x1, y1, x2, y2, status }: {
  x1: number; y1: number; x2: number; y2: number; status: Status
}) {
  const active = status !== 'offline'
  const color = STATUS_COLOR[status]
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        style={{ stroke: active ? `${color}40` : 'var(--border)' }}
        strokeWidth={1} />
      {active && (
        <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color} strokeWidth={1} strokeDasharray="3 8"
          style={{ animation: 'netflow 1.5s linear infinite' }} />
      )}
    </>
  )
}

// Icon-box centers: node at (left, top) with 40px wide, 28px icon box → center (left+20, top+14)
const AT_C   = { x: 98,  y: 14  }   // left=78,  top=0
const BR_C   = { x: 24,  y: 72  }   // left=4,   top=58
const MT5_C  = { x: 24,  y: 124 }   // left=4,   top=110
const botC   = (i: number) => ({ x: 172, y: 52 + i * 52 })  // left=152, top=38+i*52

export default function NetworkDiagram() {
  const { bots } = useBotStatus()

  const bridge  = bots.find(b => !b.bot.type || b.bot.type === 'bridge') ?? null
  const botList = bots.filter(b => b.bot.type === 'bot').slice(0, 2)
  const slots   = botList.length > 0 ? botList : [null as BotWithStatus | null]

  const bridgeS = resolveStatus(bridge)
  const mt5S: Status = !bridge?.status || bridgeS === 'offline'
    ? 'offline'
    : bridge.status.mt5Connected ? 'online' : 'warning'

  return (
    <div className="rounded-xl px-3 py-2.5"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <style>{`@keyframes netflow { to { stroke-dashoffset: -22; } }`}</style>
      <p className="text-[9px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--text-3)' }}>
        Netzwerk
      </p>

      <div style={{ position: 'relative', height: 160 }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: 160 }}
          aria-hidden="true">
          <Edge x1={AT_C.x}  y1={AT_C.y}  x2={BR_C.x}  y2={BR_C.y}  status={bridgeS} />
          <Edge x1={BR_C.x}  y1={BR_C.y}  x2={MT5_C.x} y2={MT5_C.y} status={mt5S}    />
          {slots.map((bot, i) => {
            const { x, y } = botC(i)
            const s = resolveStatus(bot)
            return (
              <g key={bot?.bot.id ?? `slot-${i}`}>
                <Edge x1={AT_C.x} y1={AT_C.y} x2={x} y2={y} status={s} />
                <Edge x1={BR_C.x} y1={BR_C.y} x2={x} y2={y} status={s} />
              </g>
            )
          })}
        </svg>

        <NetNode left={78}  top={0}   icon={Globe}   label="Alpha"  status="online"  accent={ACCENT.at}     />
        <NetNode left={4}   top={58}  icon={Cpu}     label="Bridge" status={bridgeS} accent={ACCENT.bridge}  />
        <NetNode left={4}   top={110} icon={Monitor} label="MT5"    status={mt5S}    accent={ACCENT.mt5}    />
        {slots.map((bot, i) => (
          <NetNode
            key={bot?.bot.id ?? `slot-${i}`}
            left={152}
            top={38 + i * 52}
            icon={BotIcon}
            label={bot ? bot.bot.name.slice(0, 7) : 'Kein Bot'}
            status={resolveStatus(bot)}
            accent={ACCENT.bot}
          />
        ))}
      </div>
    </div>
  )
}
