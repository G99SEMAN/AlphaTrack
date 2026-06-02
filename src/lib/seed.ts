import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const SEED_DIR = path.join(process.cwd(), 'seed')
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')

export function ensureSeedData(): void {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8')
    const profiles = JSON.parse(raw)
    if (Array.isArray(profiles) && profiles.length > 0) return
  } catch {
    // Datei existiert nicht oder ist ungueltig - weiter zum Seeding
  }

  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(SEED_DIR)) return
  const files = fs.readdirSync(SEED_DIR).filter(f => f.endsWith('.json'))
  for (const file of files) {
    const dest = path.join(DATA_DIR, file)
    // profiles.json und active.json immer schreiben (Grund fuer das Seeding)
    // Trades/Strategien nur wenn noch nicht vorhanden (vorhandene Nutzerdaten schuetzen)
    const alwaysOverwrite = file === 'profiles.json' || file === 'active.json'
    if (alwaysOverwrite || !fs.existsSync(dest)) {
      fs.copyFileSync(path.join(SEED_DIR, file), dest)
    }
  }
}
