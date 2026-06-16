import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { Trade } from '@/types/trade'
import {
  BotEntry,
  BotStatus,
  BotCommand,
  BotCommandType,
  BridgeLogEntry,
  ConnectionState,
  BotStatusWithConnection,
  BotWithStatus,
  TradeOrderPayload,
  ClosePositionPayload,
  SetParametersPayload,
} from '@/types/bot'

const DATA_DIR = path.join(process.cwd(), 'data')
const BOT_MAX_LOG_ENTRIES = 100
const CONNECTED_THRESHOLD_MS = 45_000
const WARNING_THRESHOLD_MS = 120_000

// --- Caches ---

let _botsCache: { data: BotEntry[]; ts: number } | null = null
let _botsWithStatusCache: { data: BotWithStatus[]; ts: number } | null = null
const BOTS_CACHE_TTL_MS = 5_000
const BOTS_STATUS_CACHE_TTL_MS = 2_000

// --- Hilfsfunktionen ---

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return fallback
  }
}

// --- Pfade ---

const BOTS_PATH = path.join(DATA_DIR, 'bots.json')

function botStatusPath(botId: string)   { return path.join(DATA_DIR, `bot-status-${botId}.json`) }
function bridgeLogPath(botId: string)   { return path.join(DATA_DIR, `bot-log-${botId}.json`) }
function botCommandsPath(botId: string) { return path.join(DATA_DIR, `bot-commands-${botId}.json`) }
function botTradesPath(profileId: string) { return path.join(DATA_DIR, `bot-trades-${profileId}.json`) }

// --- Bot-Konfiguration (Liste) ---

export function getBots(): BotEntry[] {
  const now = Date.now()
  if (_botsCache && now - _botsCache.ts < BOTS_CACHE_TTL_MS) return _botsCache.data
  const data = readJson<BotEntry[]>(BOTS_PATH, [])
  _botsCache = { data, ts: now }
  return data
}

export function saveBots(bots: BotEntry[]): void {
  atomicWrite(BOTS_PATH, JSON.stringify(bots, null, 2))
  _botsCache = null
  _botsWithStatusCache = null
}

export function getBotById(id: string): BotEntry | null {
  return getBots().find(b => b.id === id) ?? null
}

export function addBot(data: { name: string; profileId: string; url: string; type?: 'bridge' | 'bot' }): BotEntry {
  const type = data.type ?? 'bot'
  // Bridges: match by URL (same physical device regardless of name)
  // Bots: match by name + profileId
  const existing = type === 'bridge'
    ? getBots().find(b => (b.type ?? 'bridge') === 'bridge' && b.url === data.url)
    : getBots().find(b => (b.type ?? 'bridge') === type && b.name === data.name && b.profileId === data.profileId)
  if (existing) {
    if (existing.url !== data.url) {
      saveBots(getBots().map(b => b.id === existing.id ? { ...b, url: data.url } : b))
    }
    return { ...existing, url: data.url }
  }
  const entry: BotEntry = {
    id: nanoid(10),
    name: data.name,
    profileId: data.profileId,
    url: data.url,
    createdAt: new Date().toISOString(),
    type,
  }
  saveBots([...getBots(), entry])
  return entry
}

export function deduplicateBots(): void {
  const all = getBots()
  const seen = new Map<string, BotEntry>()
  for (const bot of all) {
    const isBridge = (bot.type ?? 'bridge') === 'bridge'
    const key = isBridge ? `bridge:url:${bot.url}` : `bot:${bot.name}:${bot.profileId}`
    if (!seen.has(key)) {
      seen.set(key, bot)
    }
  }
  if (seen.size < all.length) {
    saveBots(Array.from(seen.values()))
  }
}

export function removeBot(id: string): void {
  saveBots(getBots().filter(b => b.id !== id))
}

// --- Bot Trades ---

export function getBotTrades(profileId: string): Trade[] {
  return readJson<Trade[]>(botTradesPath(profileId), [])
}

export function saveBotTrades(profileId: string, trades: Trade[]): void {
  atomicWrite(botTradesPath(profileId), JSON.stringify(trades, null, 2))
}

// --- Bot Status ---

export function getBotStatus(botId: string): BotStatus | null {
  return readJson<BotStatus | null>(botStatusPath(botId), null)
}

export function saveBotStatus(botId: string, status: BotStatus): void {
  atomicWrite(botStatusPath(botId), JSON.stringify(status, null, 2))
  _botsWithStatusCache = null
}

export function getConnectionState(status: BotStatus | null): ConnectionState {
  if (!status) return 'offline'
  const ageMs = Date.now() - new Date(status.lastHeartbeat).getTime()
  if (ageMs < CONNECTED_THRESHOLD_MS) return 'connected'
  if (ageMs < WARNING_THRESHOLD_MS) return 'warning'
  return 'offline'
}

export function getBotStatusWithConnection(botId: string): BotStatusWithConnection | null {
  const status = getBotStatus(botId)
  if (!status) return null
  return { ...status, connectionState: getConnectionState(status) }
}

let _dedupDone = false

export function getAllBotsWithStatus(): BotWithStatus[] {
  if (!_dedupDone) {
    _dedupDone = true
    deduplicateBots()
  }
  const now = Date.now()
  if (_botsWithStatusCache && now - _botsWithStatusCache.ts < BOTS_STATUS_CACHE_TTL_MS) {
    return _botsWithStatusCache.data
  }
  const data = getBots().map(bot => ({
    bot,
    status: getBotStatusWithConnection(bot.id),
  }))
  _botsWithStatusCache = { data, ts: now }
  return data
}

// --- Bot Commands ---

export function getBotCommands(botId: string): BotCommand[] {
  return readJson<BotCommand[]>(botCommandsPath(botId), [])
}

export function saveBotCommands(botId: string, commands: BotCommand[]): void {
  atomicWrite(botCommandsPath(botId), JSON.stringify(commands, null, 2))
}

export function addBotCommand(
  botId: string,
  command: BotCommandType,
  payload?: TradeOrderPayload | ClosePositionPayload | SetParametersPayload,
): BotCommand {
  const entry: BotCommand = {
    id: nanoid(10),
    command,
    timestamp: new Date().toISOString(),
    acknowledged: false,
    ...(payload !== undefined ? { payload } : {}),
  }
  saveBotCommands(botId, [...getBotCommands(botId), entry])
  return entry
}

export function acknowledgeBotCommand(botId: string, id: string): void {
  const commands = getBotCommands(botId).map(c =>
    c.id === id ? { ...c, acknowledged: true } : c
  )
  saveBotCommands(botId, commands)
}

export function pruneOldCommands(botId: string): void {
  const confirmedCutoff = Date.now() - 5 * 60 * 1000
  const unconfirmedCutoff = Date.now() - 10 * 60 * 1000
  const fresh = getBotCommands(botId).filter(c => {
    const ts = new Date(c.timestamp).getTime()
    if (!c.acknowledged) return ts > unconfirmedCutoff
    return ts > confirmedCutoff
  })
  saveBotCommands(botId, fresh)
}

// --- Bot Log (bot-spezifische Ereignisse, getrennt von Bridge-Log, C2) ---

function botLogPath(botId: string) { return path.join(DATA_DIR, `bot-events-${botId}.json`) }

export function getBotLog(botId: string): BridgeLogEntry[] {
  return readJson<BridgeLogEntry[]>(botLogPath(botId), [])
}

export function addBotLogEntry(
  botId: string,
  level: BridgeLogEntry['level'],
  message: string,
  details?: string,
  botName?: string,
): void {
  const resolvedName = botName ?? getBotById(botId)?.name
  const entry: BridgeLogEntry = {
    id: nanoid(10),
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
    botId,
    botName: resolvedName,
  }
  const log = getBotLog(botId)
  const trimmed = [entry, ...log].slice(0, BOT_MAX_LOG_ENTRIES)
  atomicWrite(botLogPath(botId), JSON.stringify(trimmed, null, 2))
}

export function clearBotLog(botId: string): void {
  atomicWrite(botLogPath(botId), JSON.stringify([], null, 2))
}

export function bulkAddBotLogEntries(botId: string, entries: BridgeLogEntry[]): void {
  const existing = getBotLog(botId)
  const existingKeys = new Set(existing.map(e => `${e.timestamp}__${e.level}__${e.message}`))
  const fresh = entries.filter(e => e.timestamp && !existingKeys.has(`${e.timestamp}__${e.level}__${e.message}`))
  if (fresh.length === 0) return
  const merged = [...fresh, ...existing]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, BOT_MAX_LOG_ENTRIES)
  atomicWrite(botLogPath(botId), JSON.stringify(merged, null, 2))
}

// --- Bridge Log ---

export function getBridgeLog(botId: string): BridgeLogEntry[] {
  return readJson<BridgeLogEntry[]>(bridgeLogPath(botId), [])
}

export function addBridgeLogEntry(
  botId: string,
  level: BridgeLogEntry['level'],
  message: string,
  details?: string,
  botName?: string,
): void {
  const resolvedName = botName ?? getBotById(botId)?.name
  const entry: BridgeLogEntry = {
    id: nanoid(10),
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
    botId,
    botName: resolvedName,
  }
  const log = getBridgeLog(botId)
  const trimmed = [entry, ...log].slice(0, BOT_MAX_LOG_ENTRIES)
  atomicWrite(bridgeLogPath(botId), JSON.stringify(trimmed, null, 2))
}

export function clearBridgeLog(botId: string): void {
  atomicWrite(bridgeLogPath(botId), JSON.stringify([], null, 2))
}

export function bulkAddBridgeLogEntries(botId: string, entries: BridgeLogEntry[]): void {
  const existing = getBridgeLog(botId)
  const existingKeys = new Set(existing.map(e => `${e.timestamp}__${e.level}__${e.message}`))
  const fresh = entries.filter(e => e.timestamp && !existingKeys.has(`${e.timestamp}__${e.level}__${e.message}`))
  if (fresh.length === 0) return
  const merged = [...fresh, ...existing]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, BOT_MAX_LOG_ENTRIES)
  atomicWrite(bridgeLogPath(botId), JSON.stringify(merged, null, 2))
}
