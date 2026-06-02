'use server'

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { revalidatePath } from 'next/cache'
import { saveApiKeys } from '@/lib/api-keys'

const DATA_DIR = join(process.cwd(), 'data')

interface BackupBundle {
  version?: string
  exportedAt?: string
  apiKeys?: {
    ANTHROPIC_API_KEY?: string
    TWELVE_DATA_API_KEY?: string
  }
  files: Record<string, unknown>
}

export async function importSettingsAction(
  bundle: BackupBundle
): Promise<{ success: boolean; restoredFiles: string[]; apiKeysRestored: boolean; restartRequired: boolean; error?: string }> {
  if (!bundle || typeof bundle.files !== 'object') {
    return { success: false, restoredFiles: [], apiKeysRestored: false, restartRequired: false, error: 'Ungültiges Bundle-Format' }
  }

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  const ALLOWED_FILE_PATTERN = /^(profiles|active|trades-[a-zA-Z0-9_-]+|strategies-[a-zA-Z0-9_-]+)\.json$/
  const restoredFiles: string[] = []
  for (const [filename, content] of Object.entries(bundle.files)) {
    if (!ALLOWED_FILE_PATTERN.test(filename)) continue
    if (filename.includes('trades-') && !Array.isArray(content)) continue
    if (filename === 'profiles.json' && !Array.isArray(content)) continue
    writeFileSync(join(DATA_DIR, filename), JSON.stringify(content, null, 2), 'utf8')
    restoredFiles.push(filename)
  }

  const SAFE_VALUE = /^[A-Za-z0-9_\-\.]+$/

  let apiKeysRestored = false
  if (bundle.apiKeys && (bundle.apiKeys.ANTHROPIC_API_KEY || bundle.apiKeys.TWELVE_DATA_API_KEY)) {
    const keysToSave: Record<string, string> = {}
    if (bundle.apiKeys.ANTHROPIC_API_KEY && SAFE_VALUE.test(bundle.apiKeys.ANTHROPIC_API_KEY)) {
      keysToSave.ANTHROPIC_API_KEY = bundle.apiKeys.ANTHROPIC_API_KEY
    }
    if (bundle.apiKeys.TWELVE_DATA_API_KEY && SAFE_VALUE.test(bundle.apiKeys.TWELVE_DATA_API_KEY)) {
      keysToSave.TWELVE_DATA_API_KEY = bundle.apiKeys.TWELVE_DATA_API_KEY
    }
    if (Object.keys(keysToSave).length > 0) {
      saveApiKeys(keysToSave)
      apiKeysRestored = true
    }
  }

  revalidatePath('/', 'layout')

  const restartRequired = apiKeysRestored && process.env.NODE_ENV === 'production'
  return { success: true, restoredFiles, apiKeysRestored, restartRequired }
}
