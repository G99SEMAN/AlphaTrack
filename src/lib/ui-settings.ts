import fs from 'fs'
import path from 'path'

const UI_SETTINGS_FILE = path.join(process.cwd(), 'data', 'ui-settings.json')

export interface UiSettings {
  visibleExchanges: string[]
}

const DEFAULT_SETTINGS: UiSettings = {
  visibleExchanges: ['nyse', 'lse', 'xetra', 'tse'],
}

export function getUiSettings(): UiSettings {
  try {
    const raw = fs.readFileSync(UI_SETTINGS_FILE, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

export function saveUiSettings(settings: UiSettings): void {
  atomicWrite(UI_SETTINGS_FILE, JSON.stringify(settings, null, 2))
}
