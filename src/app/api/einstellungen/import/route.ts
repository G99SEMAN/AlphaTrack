import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { writeFileSync, mkdirSync, readFileSync, renameSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'data')
const SCREENSHOTS_DIR = join(DATA_DIR, 'screenshots')
const ALLOWED_ID = /^[a-zA-Z0-9_-]+$/
const ALLOWED_IMG = /^[a-zA-Z0-9_-]+\.[a-zA-Z]{2,5}$/

interface BackupBundle {
  format?: string
  profiles: Array<{ id: string }>
  trades?: Record<string, unknown[]>
  strategies?: Record<string, unknown[]>
}

function atomicWrite(path: string, content: Buffer | string): void {
  const tmp = path + '.tmp'
  writeFileSync(tmp, content)
  renameSync(tmp, path)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Keine Datei erhalten' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.byteLength > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'Backup-Datei zu groß (max. 50 MB)' }, { status: 400 })
    }

    let zip: JSZip

    try {
      zip = await JSZip.loadAsync(buffer)
    } catch {
      return NextResponse.json({ error: 'Ungültige ZIP-Datei' }, { status: 400 })
    }

    const backupEntry = zip.file('backup.json')
    if (!backupEntry) {
      return NextResponse.json({ error: 'backup.json nicht in der ZIP gefunden' }, { status: 400 })
    }

    const bundle = JSON.parse(await backupEntry.async('text')) as BackupBundle
    if (!bundle.profiles || !Array.isArray(bundle.profiles)) {
      return NextResponse.json({ error: 'Ungültiges Backup-Format' }, { status: 400 })
    }

    mkdirSync(DATA_DIR, { recursive: true })
    mkdirSync(SCREENSHOTS_DIR, { recursive: true })

    const restoredFiles: string[] = []

    // Profile zusammenführen (importierte Profile überschreiben, Rest bleibt)
    let existing: Array<{ id: string }> = []
    try {
      existing = JSON.parse(readFileSync(join(DATA_DIR, 'profiles.json'), 'utf-8'))
    } catch { /* ok - erste Installation */ }

    const importedIds = new Set(bundle.profiles.map(p => p.id))
    const kept = existing.filter(p => !importedIds.has(p.id))
    atomicWrite(join(DATA_DIR, 'profiles.json'), JSON.stringify([...kept, ...bundle.profiles], null, 2))
    restoredFiles.push('profiles.json')

    // Trades wiederherstellen
    for (const [profileId, trades] of Object.entries(bundle.trades ?? {})) {
      if (!ALLOWED_ID.test(profileId) || !Array.isArray(trades)) continue
      atomicWrite(join(DATA_DIR, `trades-${profileId}.json`), JSON.stringify(trades, null, 2))
      restoredFiles.push(`trades-${profileId}.json`)
    }

    // Strategien wiederherstellen
    for (const [profileId, strategies] of Object.entries(bundle.strategies ?? {})) {
      if (!ALLOWED_ID.test(profileId) || !Array.isArray(strategies)) continue
      atomicWrite(join(DATA_DIR, `strategies-${profileId}.json`), JSON.stringify(strategies, null, 2))
      restoredFiles.push(`strategies-${profileId}.json`)
    }

    // Screenshots wiederherstellen
    const screenshotEntries = Object.keys(zip.files).filter(
      name => name.startsWith('screenshots/') && !name.endsWith('/')
    )
    for (const entry of screenshotEntries) {
      const filename = entry.replace('screenshots/', '')
      if (!ALLOWED_IMG.test(filename)) continue
      const content = await zip.files[entry].async('nodebuffer')
      atomicWrite(join(SCREENSHOTS_DIR, filename), content)
      restoredFiles.push(`screenshots/${filename}`)
    }

    return NextResponse.json({
      success: true,
      restoredFiles,
      profileCount: bundle.profiles.length,
      screenshotCount: screenshotEntries.length,
    })
  } catch (err) {
    console.error('Import-Fehler:', err)
    return NextResponse.json({ error: 'Import fehlgeschlagen' }, { status: 500 })
  }
}
