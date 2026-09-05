import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export function atomicWrite(filePath: string, data: string): void {
  // Unique per-call temp name — a fixed name would let two concurrent writes to the
  // same filePath race on the same .tmp file, so the second rename hits ENOENT.
  const tmp = `${filePath}.${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(tmp, data, 'utf-8')
  fs.renameSync(tmp, filePath)
}
