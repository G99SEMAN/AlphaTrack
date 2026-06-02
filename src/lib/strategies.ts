import { Strategy } from '@/types/strategy'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')

function getStrategyFilePath(profileId: string): string {
  return path.join(DATA_DIR, `strategies-${profileId}.json`)
}

export function getProfileStrategies(profileId: string): Strategy[] {
  try {
    const raw = fs.readFileSync(getStrategyFilePath(profileId), 'utf-8')
    return JSON.parse(raw) as Strategy[]
  } catch {
    return []
  }
}

export function saveProfileStrategies(profileId: string, strategies: Strategy[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const filePath = getStrategyFilePath(profileId)
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(strategies, null, 2), 'utf-8')
  fs.renameSync(tmp, filePath)
}
