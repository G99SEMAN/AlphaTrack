import fs from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'analyse-history.json')
const MAX_ENTRIES = 10

export interface AnalyseHistoryEntry {
  id: string
  timestamp: string
  duration: 'scalping' | 'intraday'
  symbol?: string
  bias: 'Long' | 'Short' | 'Neutral'
  confidence: 'Hoch' | 'Mittel' | 'Niedrig'
  entry_zone: string
  stop_loss: string
  take_profit: string
  risk_reward: string
  reasoning: string
  timeframe: string
  currentPrice?: string
}

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function getAnalyseHistory(): AnalyseHistoryEntry[] {
  ensureDir()
  if (!fs.existsSync(FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as AnalyseHistoryEntry[]
  } catch {
    return []
  }
}

export function saveAnalyseEntry(
  entry: Omit<AnalyseHistoryEntry, 'id' | 'timestamp'>
): AnalyseHistoryEntry {
  const existing = getAnalyseHistory()
  const newEntry: AnalyseHistoryEntry = {
    ...entry,
    id: nanoid(10),
    timestamp: new Date().toISOString(),
  }
  const updated = [newEntry, ...existing].slice(0, MAX_ENTRIES)
  atomicWrite(FILE, JSON.stringify(updated, null, 2))
  return newEntry
}
