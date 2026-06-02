'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'
import fs from 'fs'
import path from 'path'
import { Profile, Deposit } from '@/types/profile'
import { Trade } from '@/types/trade'
import { Strategy, Timeframe } from '@/types/strategy'
import {
  createProfile,
  updateProfile,
  setActiveProfileId,
  deleteProfile,
  getActiveProfileId,
  getProfiles,
  getProfileTrades,
  saveProfileTrades,
} from '@/lib/profiles'
import { getProfileStrategies, saveProfileStrategies } from '@/lib/strategies'

// --- Profile Actions ---

export async function createProfileAction(formData: FormData) {
  const profile: Profile = {
    id: nanoid(10),
    name: formData.get('name') as string,
    type: formData.get('type') as 'live' | 'demo',
    broker: formData.get('broker') as string,
    startCapital: parseFloat(formData.get('startCapital') as string),
    currency: formData.get('currency') as Profile['currency'],
    color: formData.get('color') as string,
    icon: (formData.get('icon') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    createdAt: new Date().toISOString(),
  }
  createProfile(profile)
  setActiveProfileId(profile.id)
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function switchProfileAction(profileId: string) {
  setActiveProfileId(profileId)
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function deleteProfileAction(profileId: string) {
  deleteProfile(profileId)
  revalidatePath('/', 'layout')
  if (getProfiles().length === 0) redirect('/setup')
}

export async function addProfileFromModalAction(formData: FormData) {
  const profile: Profile = {
    id: nanoid(10),
    name: formData.get('name') as string,
    type: formData.get('type') as 'live' | 'demo',
    broker: formData.get('broker') as string,
    startCapital: parseFloat(formData.get('startCapital') as string),
    currency: formData.get('currency') as Profile['currency'],
    color: formData.get('color') as string,
    icon: (formData.get('icon') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    createdAt: new Date().toISOString(),
  }
  createProfile(profile)
  setActiveProfileId(profile.id)
  revalidatePath('/', 'layout')
}

export async function finishSetupAction() {
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function updateStartCapitalAction(newCapital: number) {
  const activeId = getActiveProfileId()
  if (!activeId) return
  const existing = getProfiles().find(p => p.id === activeId)
  if (!existing) return
  updateProfile({ ...existing, startCapital: newCapital })
}

export async function updateProfileAction(profileId: string, formData: FormData) {
  const existing = getProfiles().find(p => p.id === profileId)
  if (!existing) return
  const updated: Profile = {
    ...existing,
    name: formData.get('name') as string,
    type: formData.get('type') as 'live' | 'demo',
    broker: formData.get('broker') as string,
    color: formData.get('color') as string,
    icon: (formData.get('icon') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    currency: (formData.get('currency') as Profile['currency']) || existing.currency,
  }
  updateProfile(updated)
  revalidatePath('/', 'layout')
}

export async function addDepositAction(profileId: string, formData: FormData) {
  const existing = getProfiles().find(p => p.id === profileId)
  if (!existing) return
  const amount = parseFloat(formData.get('amount') as string)
  if (isNaN(amount) || amount === 0) return
  const deposit: Deposit = {
    id: nanoid(10),
    date: formData.get('date') as string,
    amount,
    note: (formData.get('note') as string) || undefined,
  }
  updateProfile({ ...existing, deposits: [...(existing.deposits ?? []), deposit] })
  revalidatePath('/', 'layout')
}

export async function deleteDepositAction(profileId: string, depositId: string) {
  const existing = getProfiles().find(p => p.id === profileId)
  if (!existing) return
  updateProfile({ ...existing, deposits: (existing.deposits ?? []).filter(d => d.id !== depositId) })
  revalidatePath('/', 'layout')
}

// --- Trade Actions ---

const ALLOWED_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

async function saveScreenshotFile(file: File, tradeId: string): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  if (!ALLOWED_IMAGE_EXTS.has(ext)) throw new Error('Ungültiges Bildformat')
  const filename = `${tradeId}.${ext}`
  const dir = path.join(process.cwd(), 'data', 'screenshots')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(path.join(dir, filename), buffer)
  return `/api/screenshots/${filename}`
}

function deleteScreenshotFile(screenshotPath: string) {
  try {
    const filename = path.basename(screenshotPath)
    const filepath = path.join(process.cwd(), 'data', 'screenshots', filename)
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[AlphaTrack] Screenshot löschen fehlgeschlagen:', err)
    }
  }
}

function getString(formData: FormData, key: string): string {
  return (formData.get(key) as string | null) ?? ''
}

function parseTradeFormData(formData: FormData, screenshotPath: string | undefined, existingId?: string): Trade {
  const pnlRaw = getString(formData, 'pnl')
  const outcomeRaw = getString(formData, 'outcome')
  const exitRaw = getString(formData, 'exit')
  const tpRaw = getString(formData, 'tp')
  const slRaw = getString(formData, 'sl')
  const commissionRaw = getString(formData, 'commission')
  const swapRaw = getString(formData, 'swap')
  const spreadCostRaw = getString(formData, 'spreadCost')
  const tagsRaw = getString(formData, 'tags')
  const strategyIdRaw = getString(formData, 'strategyId')
  const closeTimeRaw = getString(formData, 'closeTime')

  const entry = parseFloat(getString(formData, 'entry'))
  const tp = tpRaw ? parseFloat(tpRaw) : undefined
  const sl = slRaw ? parseFloat(slRaw) : undefined
  const type = formData.get('type') as Trade['type']

  let rr: number | undefined
  if (tp !== undefined && sl !== undefined && !isNaN(entry) && !isNaN(tp) && !isNaN(sl)) {
    const reward = type === 'long' ? tp - entry : entry - tp
    const risk = type === 'long' ? entry - sl : sl - entry
    if (risk > 0) rr = Math.round((reward / risk) * 100) / 100
  }

  return {
    id: existingId ?? nanoid(10),
    date: getString(formData, 'date'),
    closeTime: closeTimeRaw || undefined,
    instrument: getString(formData, 'instrument'),
    type,
    entry,
    exit: exitRaw ? parseFloat(exitRaw) : undefined,
    size: parseFloat(getString(formData, 'size')),
    tp,
    sl,
    pnl: pnlRaw ? parseFloat(pnlRaw) : undefined,
    outcome: !pnlRaw && (outcomeRaw === 'win' || outcomeRaw === 'loss') ? outcomeRaw : undefined,
    commission: commissionRaw ? parseFloat(commissionRaw) : undefined,
    swap: swapRaw ? parseFloat(swapRaw) : undefined,
    spreadCost: spreadCostRaw ? parseFloat(spreadCostRaw) : undefined,
    rr,
    status: getString(formData, 'status') as Trade['status'],
    notes: getString(formData, 'notes') || undefined,
    tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    strategyId: strategyIdRaw || undefined,
    screenshot: screenshotPath,
  }
}

export async function createTradeAction(formData: FormData) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const id = nanoid(10)
  let screenshotPath: string | undefined
  const file = formData.get('screenshot') as File | null
  if (file && file.size > 0) {
    screenshotPath = await saveScreenshotFile(file, id)
  }

  const trades = getProfileTrades(activeId)
  trades.push(parseTradeFormData(formData, screenshotPath, id))
  saveProfileTrades(activeId, trades)
  revalidatePath('/journal')
}

export async function updateTradeAction(tradeId: string, formData: FormData) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const trades = getProfileTrades(activeId)
  const existing = trades.find(t => t.id === tradeId)

  let screenshotPath = existing?.screenshot

  const removeScreenshot = formData.get('removeScreenshot') === 'true'
  if (removeScreenshot && screenshotPath) {
    deleteScreenshotFile(screenshotPath)
    screenshotPath = undefined
  }

  const file = formData.get('screenshot') as File | null
  if (file && file.size > 0) {
    if (screenshotPath) deleteScreenshotFile(screenshotPath)
    screenshotPath = await saveScreenshotFile(file, tradeId)
  }

  const updated = trades.map(t =>
    t.id === tradeId ? parseTradeFormData(formData, screenshotPath, tradeId) : t
  )
  saveProfileTrades(activeId, updated)
  revalidatePath('/journal')
}

export async function deleteTradeAction(tradeId: string) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const trades = getProfileTrades(activeId)
  const trade = trades.find(t => t.id === tradeId)
  if (trade?.screenshot) deleteScreenshotFile(trade.screenshot)

  saveProfileTrades(activeId, trades.filter(t => t.id !== tradeId))
  revalidatePath('/journal')
}

// --- Strategy Actions ---

function parseStrategyFormData(formData: FormData, existingId?: string): Strategy {
  return {
    id: existingId ?? nanoid(10),
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || '',
    timeframe: formData.get('timeframe') as Timeframe,
    rules: (formData.getAll('rule') as string[]).filter(Boolean),
    notes: (formData.get('notes') as string) || '',
    riskPerTrade: parseFloat(formData.get('riskPerTrade') as string) || 1,
    color: formData.get('color') as string,
    createdAt: existingId ? (formData.get('createdAt') as string) : new Date().toISOString(),
  }
}

export async function createStrategyAction(formData: FormData) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const strategies = getProfileStrategies(activeId)
  strategies.push(parseStrategyFormData(formData))
  saveProfileStrategies(activeId, strategies)
  revalidatePath('/strategien')
  revalidatePath('/journal')
}

export async function updateStrategyAction(strategyId: string, formData: FormData) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const strategies = getProfileStrategies(activeId)
  const updated = strategies.map(s =>
    s.id === strategyId ? parseStrategyFormData(formData, strategyId) : s
  )
  saveProfileStrategies(activeId, updated)
  revalidatePath('/strategien')
  revalidatePath('/journal')
}

export async function deleteStrategyAction(strategyId: string) {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const strategies = getProfileStrategies(activeId).filter(s => s.id !== strategyId)
  saveProfileStrategies(activeId, strategies)
  revalidatePath('/strategien')
  revalidatePath('/journal')
}

// --- Import Actions ---

export async function importTradesAction(
  incoming: Omit<Trade, 'id'>[]
): Promise<{ imported: number; skipped: number }> {
  const activeId = getActiveProfileId()
  if (!activeId) redirect('/setup')

  const existing = getProfileTrades(activeId)
  const existingExternalIds = new Set(
    existing.map(t => t.externalId).filter(Boolean)
  )

  const toAdd = incoming.filter(
    t => !t.externalId || !existingExternalIds.has(t.externalId)
  )

  const withIds: Trade[] = toAdd.map(t => ({ ...t, id: nanoid(10) }))
  saveProfileTrades(activeId, [...existing, ...withIds])
  revalidatePath('/journal')

  return { imported: withIds.length, skipped: incoming.length - withIds.length }
}

export async function importBotTradesAction(
  profileId: string,
  incoming: Omit<Trade, 'id'>[],
  newStartCapital?: number,
): Promise<{ imported: number; skipped: number }> {
  const profiles = getProfiles()
  const profile = profiles.find(p => p.id === profileId)
  if (!profile) return { imported: 0, skipped: 0 }

  if (newStartCapital !== undefined && newStartCapital !== profile.startCapital) {
    updateProfile({ ...profile, startCapital: newStartCapital })
  }

  const existing = getProfileTrades(profileId)
  const existingExternalIds = new Set(
    existing.map(t => t.externalId).filter(Boolean)
  )

  const toAdd = incoming.filter(
    t => !t.externalId || !existingExternalIds.has(t.externalId)
  )

  const withIds: Trade[] = toAdd.map(t => ({ ...t, id: nanoid(10) }))
  saveProfileTrades(profileId, [...existing, ...withIds])
  revalidatePath('/journal')
  revalidatePath('/dashboard')

  return { imported: withIds.length, skipped: incoming.length - withIds.length }
}
