import { Trade } from './trade'

export type BotState = 'running' | 'paused' | 'stopped' | 'error' | 'disconnected'
export type ConnectionState = 'connected' | 'warning' | 'offline'
export type BotCommandType = 'start' | 'stop' | 'pause' | 'resume' | 'execute_trade' | 'close_position' | 'restart'

export interface ClosePositionPayload {
  ticket: number
}

export interface TradeOrderPayload {
  symbol: string
  direction: 'buy' | 'sell'
  lots: number
  sl?: number
  tp?: number
  slPips?: number
  tpPips?: number
}

export interface TradeOrderResult {
  success: boolean
  ticket?: number
  error?: string
  symbol: string
  direction: string
  lots: number
  timestamp: string
}
export type LogLevel = 'info' | 'warn' | 'error'

// Konfigurierter Bot-Eintrag (gespeichert in data/bots.json)
export interface BotEntry {
  id: string
  name: string
  profileId: string
  url: string       // Flask Command-Server, z.B. http://192.168.1.100:8765
  createdAt: string
  type?: 'bridge' | 'bot'  // fehlendes Feld = bridge (Rückwärtskompatibilität)
}

export interface BotStatus {
  state: BotState
  lastHeartbeat: string
  bridgeVersion: string
  mt5Connected: boolean
  activeSymbols: string[]
  openPositions: number
  tradesSync: number
  uptime: number
  balance?: number
  currency?: string
}

export interface BotCommand {
  id: string
  command: BotCommandType
  timestamp: string
  acknowledged: boolean
}

export interface BridgeLogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  details?: string
  botId?: string
  botName?: string
}

// Für Python-Bridge-Konfig-Datei (bridge/config.json)
export interface BridgeConfig {
  alphatrack_url: string
  api_key: string
  bridge_id: string
  bridge_name: string
  bridge_version: string
  profile_id: string
  heartbeat_interval_sec: number
  trade_sync_interval_sec: number
  command_server_port: number
  mt5_account: number
  mt5_server: string
  symbols_to_watch: string[]
}

// Payload-Typen für API-Routen

export interface BridgeHeartbeatPayload {
  bridgeId: string
  status: BotStatus
}

export interface BridgeTradesPayload {
  bridgeId: string
  profileId: string
  trades: Omit<Trade, 'id'>[]
}

export interface BridgeCommandPayload {
  bridgeId: string
  command: BotCommandType
}

// Status mit berechnetem Verbindungszustand (für UI)
export interface BotStatusWithConnection extends BotStatus {
  connectionState: ConnectionState
}

// Vollständiger Bot-Eintrag inkl. Status für UI-Übersichten
export interface BotWithStatus {
  bot: BotEntry
  status: BotStatusWithConnection | null
}
