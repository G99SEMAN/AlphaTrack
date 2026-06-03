'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Cpu, Monitor, Bot as BotIcon, RotateCcw } from 'lucide-react'
import { useBotStatus } from '@/context/BotStatusContext'
import type { BotWithStatus } from '@/types/bot'

type Status = 'online' | 'warning' | 'offline'

const SC: Record<Status, string> = {
  online: '#00d97e', warning: '#f59e0b', offline: '#ef4444',
}
const ACCENT = { at: '#00d97e', bridge: '#a855f7', mt5: '#60a5fa', bot: '#f59e0b' }

const R     = 32
const SVG_W = 630
const SVG_H = 560

// Default positions
const DEFAULT_POS: Record<string, { x: number; y: number }> = {
  at:     { x: 220, y: 80  },
  bridge: { x: 72,  y: 240 },
  mt5:    { x: 72,  y: 400 },
}
const defaultBotPos = (i: number) => ({ x: 540, y: 140 + i * 150 })

function ePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
}

function resolveStatus(bw: BotWithStatus | null | undefined): Status {
  if (!bw?.status) return 'offline'
  const cs = bw.status.connectionState
  return cs === 'connected' ? 'online' : cs === 'warning' ? 'warning' : 'offline'
}

interface NodeData {
  id: string; x: number; y: number
  status: Status; accent: string
  label: string; sub: string
  Icon: React.ElementType
}

export default function NetworkDiagramFull() {
  const { bots, lastUpdated } = useBotStatus()

  const bridge  = bots.find(b => !b.bot.type || b.bot.type === 'bridge') ?? null
  const botList = bots.filter(b => b.bot.type === 'bot')

  const bridgeS = resolveStatus(bridge)
  const mt5S: Status = !bridge?.status || bridgeS === 'offline'
    ? 'offline'
    : bridge.status.mt5Connected ? 'online' : 'warning'

  // ── Drag state ────────────────────────────────────────────────────
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({
    ...DEFAULT_POS,
  })
  const [dragging, setDragging] = useState<string | null>(null)
  const dragStart = useRef<{ mx: number; my: number; nx: number; ny: number } | null>(null)

  // Initialise positions for new nodes (don't overwrite existing)
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev }
      if (!next.at)     next.at     = DEFAULT_POS.at
      if (!next.bridge) next.bridge = DEFAULT_POS.bridge
      if (!next.mt5)    next.mt5    = DEFAULT_POS.mt5
      const list = botList.length > 0 ? botList : [null as BotWithStatus | null]
      list.forEach((bw, i) => {
        const id = bw ? `bot-${bw.bot.id}` : 'no-bot'
        if (!next[id]) next[id] = defaultBotPos(i)
      })
      return next
    })
  }, [bots]) // eslint-disable-line react-hooks/exhaustive-deps

  // Window-level mouse handlers while dragging
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return
      const { mx, my, nx, ny } = dragStart.current
      setPositions(prev => ({
        ...prev,
        [dragging]: {
          x: Math.max(R + 4, Math.min(SVG_W - R - 4, nx + (e.clientX - mx))),
          y: Math.max(R + 4, Math.min(SVG_H - R - 50, ny + (e.clientY - my))),
        },
      }))
    }
    const onUp = () => { setDragging(null); dragStart.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const startDrag = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    const pos = positions[id]
    if (!pos) return
    dragStart.current = { mx: e.clientX, my: e.clientY, nx: pos.x, ny: pos.y }
    setDragging(id)
  }

  const resetPositions = () => {
    const fresh: Record<string, { x: number; y: number }> = { ...DEFAULT_POS }
    const list = botList.length > 0 ? botList : [null as BotWithStatus | null]
    list.forEach((bw, i) => {
      fresh[bw ? `bot-${bw.bot.id}` : 'no-bot'] = defaultBotPos(i)
    })
    setPositions(fresh)
  }

  // ── Build nodes ───────────────────────────────────────────────────
  const botEntries = botList.length > 0 ? botList : [null as BotWithStatus | null]

  const nodes: NodeData[] = [
    {
      id: 'at', ...(positions.at ?? DEFAULT_POS.at),
      status: 'online', accent: ACCENT.at, Icon: Globe,
      label: 'AlphaTrack',
      sub: `${bots.length} Verbindung${bots.length !== 1 ? 'en' : ''}`,
    },
    {
      id: 'bridge', ...(positions.bridge ?? DEFAULT_POS.bridge),
      status: bridgeS, accent: ACCENT.bridge, Icon: Cpu,
      label: bridge?.bot.name ?? 'Bridge',
      sub: bridgeS === 'online'
        ? `${bridge?.status?.openPositions ?? 0} offene Positionen`
        : bridgeS === 'warning' ? 'Verbindungsproblem' : 'Nicht verbunden',
    },
    {
      id: 'mt5', ...(positions.mt5 ?? DEFAULT_POS.mt5),
      status: mt5S, accent: ACCENT.mt5, Icon: Monitor,
      label: 'MetaTrader 5',
      sub: mt5S === 'online' && bridge?.status?.balance != null
        ? `${bridge.status.balance.toFixed(2)} ${bridge.status.currency ?? ''}`
        : mt5S === 'online' ? 'Verbunden'
        : mt5S === 'warning' ? 'Nicht eingeloggt' : 'Getrennt',
    },
    ...botEntries.map((bw, i): NodeData => {
      const id  = bw ? `bot-${bw.bot.id}` : 'no-bot'
      const bs  = resolveStatus(bw)
      const pos = positions[id] ?? defaultBotPos(i)
      return {
        id, ...pos, status: bs, accent: ACCENT.bot, Icon: BotIcon,
        label: bw?.bot.name ?? 'Kein Bot',
        sub: !bw ? 'Noch kein Bot registriert'
          : bs === 'online' ? `${bw.status?.openPositions ?? 0} Positionen`
          : bw.status?.state === 'paused' ? 'Pausiert'
          : bw.status?.state === 'stopped' ? 'Gestoppt' : 'Offline',
      }
    }),
  ]

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const edges = [
    { id: 'at-bridge', a: 'at',     b: 'bridge', status: bridgeS },
    { id: 'br-mt5',    a: 'bridge', b: 'mt5',    status: mt5S    },
    ...botEntries.map((bw, i) => ({
      id: `at-bot-${bw?.bot.id ?? i}`,
      a: 'at', b: bw ? `bot-${bw.bot.id}` : 'no-bot',
      status: resolveStatus(bw),
    })),
    ...botEntries.map((bw, i) => ({
      id: `br-bot-${bw?.bot.id ?? i}`,
      a: 'bridge', b: bw ? `bot-${bw.bot.id}` : 'no-bot',
      status: resolveStatus(bw),
    })),
  ]

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5">
          {(['online', 'warning', 'offline'] as Status[]).map(s => (
            <div key={s} className="flex items-center gap-2">
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: SC[s], display: 'block',
                boxShadow: s === 'online' ? `0 0 6px ${SC[s]}` : 'none',
              }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                {s === 'online' ? 'Online' : s === 'warning' ? 'Warnung' : 'Offline'}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={resetPositions}
            title="Positionen zurücksetzen"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{
              color: 'var(--text-3)',
              border: '1px solid var(--border)',
              background: 'transparent',
            }}
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="p-6 lg:p-10"
        style={{ cursor: dragging ? 'grabbing' : 'default' }}>
        <div style={{ position: 'relative', width: SVG_W, height: SVG_H,
          userSelect: 'none', WebkitUserSelect: 'none' }}>

          {/* SVG: edges + circles + labels */}
          <svg width={SVG_W} height={SVG_H}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            <defs>
              {edges.map(e => {
                const a = nodeMap.get(e.a)
                const b = nodeMap.get(e.b)
                if (!a || !b) return null
                return <path key={`def-${e.id}`} id={e.id}
                  d={ePath(a.x, a.y, b.x, b.y)} />
              })}
            </defs>

            {edges.map(e => {
              const a = nodeMap.get(e.a)
              const b = nodeMap.get(e.b)
              if (!a || !b) return null
              const active = e.status !== 'offline'
              const color  = SC[e.status]
              return (
                <g key={e.id}>
                  <path d={ePath(a.x, a.y, b.x, b.y)} fill="none"
                    stroke={active ? `${color}30` : 'var(--border)'}
                    strokeWidth={active ? 2 : 1}
                    strokeDasharray={active ? undefined : '5 5'} />
                  {active && (
                    <circle r="5" fill={color} opacity={0.85}>
                      <animateMotion dur="2.2s" repeatCount="indefinite">
                        <mpath href={`#${e.id}`} />
                      </animateMotion>
                    </circle>
                  )}
                </g>
              )
            })}

            {nodes.map(n => {
              const color = SC[n.status]
              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={R + 12}
                    fill={`${n.accent}07`} stroke={`${n.accent}15`} strokeWidth={1} />
                  <circle cx={n.x} cy={n.y} r={R}
                    fill={`${n.accent}18`} stroke={`${n.accent}45`} strokeWidth={1.5} />
                  <circle cx={n.x} cy={n.y} r={R} fill="none"
                    stroke={color} strokeWidth={1.5} opacity={0.55}
                    strokeDasharray={n.status === 'offline' ? '4 5' : undefined} />
                  <circle cx={n.x + R * 0.68} cy={n.y + R * 0.68} r={6}
                    fill={color} stroke="var(--surface-1)" strokeWidth={2} />
                  <text x={n.x} y={n.y + R + 20}
                    textAnchor="middle" fontSize={13} fontWeight={700}
                    style={{ fill: 'var(--text-1)', pointerEvents: 'none' }}>{n.label}</text>
                  <text x={n.x} y={n.y + R + 36}
                    textAnchor="middle" fontSize={11}
                    style={{ fill: 'var(--text-3)', pointerEvents: 'none' }}>{n.sub}</text>
                </g>
              )
            })}
          </svg>

          {/* Draggable icon overlays */}
          {nodes.map(n => {
            const Icon = n.Icon
            const isDragging = dragging === n.id
            return (
              <div
                key={`icon-${n.id}`}
                onMouseDown={e => startDrag(n.id, e)}
                style={{
                  position: 'absolute',
                  left: n.x - R, top: n.y - R,
                  width: R * 2, height: R * 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  borderRadius: '50%',
                  zIndex: isDragging ? 10 : 1,
                }}
              >
                <Icon size={20} color={n.accent} />
              </div>
            )
          })}

        </div>
      </div>
    </div>
  )
}
