import { cache } from 'react'
import { Profile, ActiveProfile } from '@/types/profile'
import { Trade } from '@/types/trade'
import { saveProfileStrategies } from '@/lib/strategies'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')
const ACTIVE_FILE = path.join(DATA_DIR, 'active.json')

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// --- Profile CRUD ---

export const getProfiles = cache(function getProfiles(): Profile[] {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8')
    return JSON.parse(raw) as Profile[]
  } catch {
    return []
  }
})

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  fs.mkdirSync(path.dirname(tmp), { recursive: true })
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

export function saveProfiles(profiles: Profile[]): void {
  ensureDataDir()
  atomicWrite(PROFILES_FILE, JSON.stringify(profiles, null, 2))
}

export function createProfile(profile: Profile): void {
  const profiles = getProfiles()
  profiles.push(profile)
  saveProfiles(profiles)
  saveProfileTrades(profile.id, [])
  saveProfileStrategies(profile.id, [])
}

export function updateProfile(updated: Profile): void {
  const profiles = getProfiles().map(p => p.id === updated.id ? updated : p)
  saveProfiles(profiles)
}

export function deleteProfile(profileId: string): void {
  const profiles = getProfiles().filter(p => p.id !== profileId)
  saveProfiles(profiles)
  const tradeFile = getTradeFilePath(profileId)
  try { fs.unlinkSync(tradeFile) } catch { /* ignorieren */ }
  const stratFile = path.join(DATA_DIR, `strategies-${profileId}.json`)
  try { fs.unlinkSync(stratFile) } catch { /* ignorieren */ }
  // Aktives Profil zuruecksetzen wenn noetig
  const active = getActiveProfileId()
  if (active === profileId) {
    const remaining = profiles[0]
    if (remaining) setActiveProfileId(remaining.id)
    else clearActiveProfile()
  }
}

// --- Aktives Profil ---

export const getActiveProfileId = cache(function getActiveProfileId(): string | null {
  try {
    const raw = fs.readFileSync(ACTIVE_FILE, 'utf-8')
    const data = JSON.parse(raw) as ActiveProfile
    return data.profileId
  } catch {
    return null
  }
})

export function setActiveProfileId(profileId: string): void {
  ensureDataDir()
  atomicWrite(ACTIVE_FILE, JSON.stringify({ profileId }, null, 2))
}

export function clearActiveProfile(): void {
  try { fs.unlinkSync(ACTIVE_FILE) } catch { /* ignorieren */ }
}

export const getActiveProfile = cache(function getActiveProfile(): Profile | null {
  const id = getActiveProfileId()
  if (!id) return null
  return getProfiles().find(p => p.id === id) ?? null
})

// --- Trades pro Profil ---

function getTradeFilePath(profileId: string): string {
  return path.join(DATA_DIR, `trades-${profileId}.json`)
}

export function getProfileTrades(profileId: string): Trade[] {
  try {
    const raw = fs.readFileSync(getTradeFilePath(profileId), 'utf-8')
    return JSON.parse(raw) as Trade[]
  } catch {
    return []
  }
}

export function saveProfileTrades(profileId: string, trades: Trade[]): void {
  ensureDataDir()
  atomicWrite(getTradeFilePath(profileId), JSON.stringify(trades, null, 2))
}
