import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import {
  ChecklistConfig,
  ChecklistLog,
  ChecklistDayEntry,
  CHECKLIST_BADGES,
  DEFAULT_CHECKLIST_ITEMS,
} from '@/types/checklist'
import { toLocalDateStr } from '@/lib/checklist-date'

const DATA_DIR = path.join(process.cwd(), 'data')

function getConfigFilePath(profileId: string): string {
  return path.join(DATA_DIR, `checklist-${profileId}.json`)
}

function getLogFilePath(profileId: string): string {
  return path.join(DATA_DIR, `checklist-log-${profileId}.json`)
}

function atomicWrite(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

export function getChecklistConfig(profileId: string): ChecklistConfig | null {
  try {
    const raw = fs.readFileSync(getConfigFilePath(profileId), 'utf-8')
    return JSON.parse(raw) as ChecklistConfig
  } catch {
    return null
  }
}

export function saveChecklistConfig(config: ChecklistConfig): void {
  atomicWrite(getConfigFilePath(config.profileId), JSON.stringify(config, null, 2))
}

export function createDefaultChecklistConfig(profileId: string): ChecklistConfig {
  const now = new Date().toISOString()
  return {
    profileId,
    items: DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
      ...item,
      id: nanoid(10),
      order: index,
      createdAt: now,
    })),
    createdAt: now,
  }
}

export function getChecklistLog(profileId: string): ChecklistLog {
  try {
    const raw = fs.readFileSync(getLogFilePath(profileId), 'utf-8')
    return JSON.parse(raw) as ChecklistLog
  } catch {
    return { profileId, entries: [], unlockedBadges: {} }
  }
}

export function saveChecklistLog(log: ChecklistLog): void {
  atomicWrite(getLogFilePath(log.profileId), JSON.stringify(log, null, 2))
}

export function calcChecklistStreak(log: ChecklistLog, today: Date = new Date()): number {
  const entryByDate = new Map(log.entries.map(e => [e.date, e]))
  const todayEntry = entryByDate.get(toLocalDateStr(today))
  const todayHeld = !!todayEntry && (todayEntry.completed || todayEntry.freeze)

  let streak = 0
  const cursor = new Date(today)
  if (!todayHeld) {
    cursor.setDate(cursor.getDate() - 1)
  }
  for (;;) {
    const entry = entryByDate.get(toLocalDateStr(cursor))
    if (entry && (entry.completed || entry.freeze)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export function calcChecklistLifetime(log: ChecklistLog): number {
  return log.entries.filter(e => e.completed).length
}

function checkAndUnlockBadges(log: ChecklistLog): void {
  const streak = calcChecklistStreak(log)
  const lifetime = calcChecklistLifetime(log)
  const now = new Date().toISOString()
  for (const badge of CHECKLIST_BADGES) {
    if (log.unlockedBadges[badge.id]) continue
    const value = badge.kind === 'streak' ? streak : lifetime
    if (value >= badge.threshold) {
      log.unlockedBadges[badge.id] = now
    }
  }
}

function upsertEntry(log: ChecklistLog, entry: ChecklistDayEntry): ChecklistLog {
  const entries = log.entries.filter(e => e.date !== entry.date)
  entries.push(entry)
  return { ...log, entries }
}

export function saveDayEntry(
  profileId: string,
  date: string,
  values: Record<string, boolean | number>,
): ChecklistLog {
  const config = getChecklistConfig(profileId)
  const completed = config !== null && config.items.every(item => values[item.id] !== undefined)
  const log = upsertEntry(getChecklistLog(profileId), { date, values, completed })
  checkAndUnlockBadges(log)
  saveChecklistLog(log)
  return log
}

export function setFreezeDay(profileId: string, date: string): ChecklistLog {
  const log = upsertEntry(getChecklistLog(profileId), { date, values: {}, completed: false, freeze: true })
  checkAndUnlockBadges(log)
  saveChecklistLog(log)
  return log
}
