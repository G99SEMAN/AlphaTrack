'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Cpu, Monitor, Bot as BotIcon, RotateCcw } from 'lucide-react'
import { useBotStatus } from '@/context/BotStatusContext'
import type { BotWithStatus } from '@/types/bot'
import { useTranslations } from 'next-intl'

type Status = 'online' | 'warning' | 'offline'

const SC: Record<Status, string> = {
  online: '#00d97e', warning: '#f59e0b', offline: '#ef4444',
}
const ACCENT = { at: '#00d97e', bridge: '#a855f7', mt5: '#60a5fa', bot: '#f59e0b' }

const R     = 28
const MIN_W = 480
const MIN_H = 400

const DEFAULT_POS: Record<string, { x: number; y: number }> = {
  at:     { x: 200, y: 65  },
  bridge: { x: 65,  y: 205 },
  mt5:    { x: 65,  y: 345 },
}
const defaultBotPos = (i: number) => ({ x: 400, y: 100 + i * 130 })

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
  const t = useTranslations('netzwerk.diagram')
  const { bots, lastUpdated } = useBotStatus()

  const bridge  = bots.find(b => !b.bot.type || b.bot.type === 'bridge') ?? null
  const botList = bots.filter(b => b.bot.type === 'bot' && b.status != null && b.status.connectionState !== 'offline')

  const bridgeS = resolveStatus(bridge)
  const mt5S: Status = !bridge?.status || bridgeS === 'offline'
    ? 'offline'
    : bridge.status.mt5Connected ? 'online' : 'warning'

  const STORAGE_KEY = 'alphatrack-network-positions'

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...DEFAULT_POS, ...JSON.parse(saved) } : { ...DEFAULT_POS }
    } catch { return { ...DEFAULT_POS } }
  })
  const [dragging, setDragging] = useState<string | null>(null)
  const dragStart = useRef<{ mx: number; my: number; nx: number; ny: number } | null>(null)
  const svgDimsRef = useRef({ w: MIN_W, h: MIN_H })

  // Persist positions to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)) } catch { /* silent */ }
  }, [positions])

  // Initialise positions for newly seen nodes (don't overwrite saved ones)
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev }
      if (!next.at)     next.at     = DEFAULT_POS.at
      if (!next.bridge) next.bridge = DEFAULT_POS.bridge
      if (!next.mt5)    next.mt5    = DEFAULT_POS.mt5
      botList.forEach((bw, i) => {
        const id = `bot-${bw.bot.id}`
        if (!next[id]) next[id] = defaultBotPos(i)
      })
      return next
    })
  }, [bots]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return
      const { mx, my, nx, ny } = dragStart.current
      setPositions(prev => ({
        ...prev,
        [dragging]: {
          x: Math.max(R + 4, Math.min(svgDimsRef.current.w - R - 4, nx + (e.clientX - mx))),
          y: Math.max(R + 4, Math.min(svgDimsRef.current.h - R - 50, ny + (e.clientY - my))),
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
    botList.forEach((bw, i) => {
      fresh[`bot-${bw.bot.id}`] = defaultBotPos(i)
    })
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* silent */ }
    setPositions(fresh)
  }

  const showBridge = bridgeS !== 'offline'
  const showMt5    = mt5S    !== 'offline'

  const nodes: NodeData[] = [
    {
      id: 'at', ...(positions.at ?? DEFAULT_POS.at),
      status: 'online', accent: ACCENT.at, Icon: Globe,
      label: 'AlphaTrack',
      sub: showBridge ? t('bridgeConnectedSub') : t('noConnectionSub'),
    },
    ...(showBridge ? [{
      id: 'bridge', ...(positions.bridge ?? DEFAULT_POS.bridge),
      status: bridgeS, accent: ACCENT.bridge, Icon: Cpu,
      label: bridge?.bot.name ?? 'Bridge',
      sub: bridgeS === 'online'
        ? t('bridgeOpenPositions', { count: bridge?.status?.openPositions ?? 0 })
        : t('connectionProblemSub'),
    } as NodeData] : []),
    ...(showMt5 ? [{
      id: 'mt5', ...(positions.mt5 ?? DEFAULT_POS.mt5),
      status: mt5S, accent: ACCENT.mt5, Icon: Monitor,
      label: 'MetaTrader 5',
      sub: mt5S === 'online' && bridge?.status?.balance != null
        ? `${bridge.status.balance.toFixed(2)} ${bridge.status.currency ?? ''}`
        : mt5S === 'online' ? t('mt5ConnectedSub') : t('mt5NotLoggedInSub'),
    } as NodeData] : []),
    ...botList.map((bw, i): NodeData => {
      const id  = `bot-${bw.bot.id}`
      const bs  = resolveStatus(bw)
      const pos = positions[id] ?? defaultBotPos(i)
      return {
        id, ...pos, status: bs, accent: ACCENT.bot, Icon: BotIcon,
        label: bw.bot.name,
        sub: bs === 'online' ? t('botPositions', { count: bw.status?.openPositions ?? 0 })
          : bw.status?.state === 'paused' ? t('botPausedSub') : t('botStoppedSub'),
      }
    }),
  ]

  const svgW = nodes.length === 0 ? MIN_W : Math.max(MIN_W, Math.max(...nodes.map(n => n.x)) + 90)
  const svgH = nodes.length === 0 ? MIN_H : Math.max(MIN_H, Math.max(...nodes.map(n => n.y)) + 80)
  svgDimsRef.current = { w: svgW, h: svgH }

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Edges defined A→B, animation runs reversed (1→0) so dots travel towards AlphaTrack
  const edges = [
    ...(showBridge ? [{ id: 'at-bridge', a: 'at', b: 'bridge', status: bridgeS }] : []),
    ...(showBridge && showMt5 ? [{ id: 'br-mt5', a: 'bridge', b: 'mt5', status: mt5S }] : []),
    ...(showBridge ? botList.map(bw => ({
      id: `br-bot-${bw.bot.id}`,
      a: 'bridge', b: `bot-${bw.bot.id}`,
      status: resolveStatus(bw),
    })) : []),
  ]

  return (
    <div className="rounded-2xl overflow-hidden inline-block"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          {(['online', 'warning', 'offline'] as Status[]).map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: SC[s], display: 'block',
                boxShadow: s === 'online' ? `0 0 5px ${SC[s]}` : 'none',
              }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                {s === 'online' ? t('statusOnline') : s === 'warning' ? t('statusWarning') : t('statusOffline')}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={resetPositions}
            title={t('resetTitle')}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            style={{ color: 'var(--text-3)', border: '1px solid var(--border)', background: 'transparent' }}
          >
            <RotateCcw size={10} />
            {t('resetLabel')}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="p-5" style={{ cursor: dragging ? 'grabbing' : 'default' }}>
        <div style={{ position: 'relative', width: svgW, height: svgH, userSelect: 'none', WebkitUserSelect: 'none' }}>

          <svg width={svgW} height={svgH}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            <defs>
              {edges.map(e => {
                const a = nodeMap.get(e.a)
                const b = nodeMap.get(e.b)
                if (!a || !b) return null
                return <path key={`def-${e.id}`} id={e.id} d={ePath(a.x, a.y, b.x, b.y)} />
              })}
            </defs>

            {/* Edges */}
            {edges.map(e => {
              const a = nodeMap.get(e.a)
              const b = nodeMap.get(e.b)
              if (!a || !b) return null
              const active = e.status !== 'offline'
              const color  = SC[e.status]
              return (
                <g key={e.id}>
                  <path d={ePath(a.x, a.y, b.x, b.y)} fill="none"
                    stroke={active ? `${color}35` : 'var(--border)'}
                    strokeWidth={active ? 2 : 1} />
                  {active && (
                    <circle r="4.5" fill={color} opacity={0.9}>
                      <animateMotion dur="2.2s" repeatCount="indefinite"
                        keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                        <mpath href={`#${e.id}`} />
                      </animateMotion>
                    </circle>
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const statusColor = SC[n.status]
              return (
                <g key={n.id}>
                  {/* Outer glow ring */}
                  <circle cx={n.x} cy={n.y} r={R + 10}
                    fill={`${n.accent}06`} stroke={`${n.accent}12`} strokeWidth={1} />
                  {/* Main circle — accent fill, status border */}
                  <circle cx={n.x} cy={n.y} r={R}
                    fill={`${n.accent}16`} stroke={statusColor} strokeWidth={2} />
                  {/* Label */}
                  <text x={n.x} y={n.y + R + 18}
                    textAnchor="middle" fontSize={12} fontWeight={700}
                    style={{ fill: 'var(--text-1)', pointerEvents: 'none' }}>{n.label}</text>
                  <text x={n.x} y={n.y + R + 32}
                    textAnchor="middle" fontSize={10}
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
                <Icon size={18} color={n.accent} />
              </div>
            )
          })}

        </div>
      </div>
    </div>
  )
}
