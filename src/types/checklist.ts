export type ChecklistItemType = 'boolean' | 'scale'

export interface ChecklistItem {
  id: string
  label: string
  type: ChecklistItemType
  order: number
  createdAt: string
}

export interface ChecklistConfig {
  profileId: string
  items: ChecklistItem[]
  createdAt: string
}

export interface ChecklistDayEntry {
  date: string // "YYYY-MM-DD", lokales Datum
  values: Record<string, boolean | number>
  completed: boolean
  freeze?: boolean
}

export interface ChecklistLog {
  profileId: string
  entries: ChecklistDayEntry[]
  unlockedBadges: Record<string, string> // badgeId -> ISO-Datum der Freischaltung
}

export type ChecklistBadgeKind = 'streak' | 'lifetime'

export interface ChecklistBadgeDefinition {
  id: string
  kind: ChecklistBadgeKind
  threshold: number
  name: string
}

export const CHECKLIST_BADGES: ChecklistBadgeDefinition[] = [
  { id: 'streak-3',     kind: 'streak',   threshold: 3,   name: 'Guter Start' },
  { id: 'streak-7',     kind: 'streak',   threshold: 7,   name: 'Eine Woche Disziplin' },
  { id: 'streak-30',    kind: 'streak',   threshold: 30,  name: 'Eiserner Wille' },
  { id: 'streak-100',   kind: 'streak',   threshold: 100, name: 'Trading-Mönch' },
  { id: 'streak-365',   kind: 'streak',   threshold: 365, name: 'Meister der Routine' },
  { id: 'lifetime-50',  kind: 'lifetime', threshold: 50,  name: 'Halbes Hundert' },
  { id: 'lifetime-200', kind: 'lifetime', threshold: 200, name: 'Routinier' },
  { id: 'lifetime-500', kind: 'lifetime', threshold: 500, name: 'Veteran' },
]

export const DEFAULT_CHECKLIST_ITEMS: { label: string; type: ChecklistItemType }[] = [
  { label: 'Bin ich mental in der Verfassung, um heute zu handeln?', type: 'scale' },
  { label: 'Habe ich meinen Trading-Plan / mein Setup vor dem ersten Trade überprüft?', type: 'boolean' },
  { label: 'Habe ich heute eine bewusste Entscheidung getroffen — auch wenn sie war, nicht zu traden?', type: 'boolean' },
  { label: 'Habe ich mein Risiko pro Trade innerhalb meiner Regeln gehalten?', type: 'boolean' },
  { label: 'Habe ich Trades aus Emotion (FOMO, Rache, Langeweile) vermieden?', type: 'boolean' },
  { label: 'Wie war meine Erholung/Schlafqualität vor dem Handelstag?', type: 'scale' },
]
