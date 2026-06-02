import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getProfiles, getProfileTrades } from '@/lib/profiles'
import { getProfileStrategies } from '@/lib/strategies'

const DATA_DIR = join(process.cwd(), 'data')
const SCREENSHOTS_DIR = join(DATA_DIR, 'screenshots')

export async function POST(req: Request) {
  try {
    const body = await req.json() as { profileIds?: string[] }
    const profileIds = body.profileIds ?? []
    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json({ error: 'Keine Profile ausgewählt' }, { status: 400 })
    }

    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    const allProfiles = getProfiles()
    const selectedProfiles = allProfiles.filter(p => profileIds.includes(p.id))

    const tradesMap: Record<string, unknown[]> = {}
    const strategiesMap: Record<string, unknown[]> = {}
    const screenshotFilenames: string[] = []

    for (const profile of selectedProfiles) {
      const trades = getProfileTrades(profile.id)
      const strategies = getProfileStrategies(profile.id)
      tradesMap[profile.id] = trades
      strategiesMap[profile.id] = strategies
      for (const trade of trades) {
        if (trade.screenshot) {
          const filename = trade.screenshot.replace('/api/screenshots/', '')
          screenshotFilenames.push(filename)
        }
      }
    }

    const bundle = {
      version: pkg.version,
      format: 'zip-v1',
      exportedAt: new Date().toISOString(),
      profiles: selectedProfiles,
      trades: tradesMap,
      strategies: strategiesMap,
    }

    const zip = new JSZip()
    zip.file('backup.json', JSON.stringify(bundle, null, 2))

    const screenshotsFolder = zip.folder('screenshots')!
    for (const filename of screenshotFilenames) {
      const filepath = join(SCREENSHOTS_DIR, filename)
      if (existsSync(filepath)) {
        screenshotsFolder.file(filename, readFileSync(filepath))
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="alphatrack-backup-${date}.zip"`,
      },
    })
  } catch (err) {
    console.error('Export-Fehler:', err)
    return NextResponse.json({ error: 'Export fehlgeschlagen' }, { status: 500 })
  }
}
