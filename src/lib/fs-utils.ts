import fs from 'fs'
import path from 'path'

export function atomicWrite(filePath: string, data: string): void {
  const tmp = filePath + '.tmp'
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(tmp, data, 'utf-8')
  fs.renameSync(tmp, filePath)
}
