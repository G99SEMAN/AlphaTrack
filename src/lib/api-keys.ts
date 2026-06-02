import fs from 'fs'
import path from 'path'

const KEY_FILE = path.join(process.cwd(), 'data', 'api-keys.json')

let _keyFileCache: { data: Record<string, string>; ts: number } | null = null

function loadKeyFile(): Record<string, string> {
  const now = Date.now()
  if (_keyFileCache && now - _keyFileCache.ts < 30_000) return _keyFileCache.data
  try {
    const data = JSON.parse(fs.readFileSync(KEY_FILE, 'utf-8'))
    _keyFileCache = { data, ts: now }
    return data
  } catch { return {} }
}

const ALLOWED_KEY_NAMES = new Set(['ANTHROPIC_API_KEY', 'BOT_API_KEY'])

export function getApiKey(name: string): string | undefined {
  if (!ALLOWED_KEY_NAMES.has(name)) return undefined
  // process.env hat Vorrang (docker-compose env_file, .env.local lokal)
  if (process.env[name]) return process.env[name]
  // Fallback: persistierte Keys aus data/api-keys.json (NAS-Import)
  return loadKeyFile()[name] || undefined
}

export function saveApiKeys(keys: Record<string, string>): void {
  const existing = loadKeyFile()
  const updated = { ...existing, ...keys }
  const tmp = KEY_FILE + '.tmp'
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true })
  fs.writeFileSync(tmp, JSON.stringify(updated, null, 2), 'utf-8')
  fs.renameSync(tmp, KEY_FILE)
  _keyFileCache = null
}
