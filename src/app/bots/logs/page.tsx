import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { getBots, getBridgeLog } from '@/lib/bot-data'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BotsLogsClient from './BotsLogsClient'
import { BridgeLogEntry } from '@/types/bot'

const MAX_INITIAL = 300

export default async function BotsLogsPage() {
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const bots = getBots()
  const allLogs: BridgeLogEntry[] = bots.flatMap(bot => getBridgeLog(bot.id))
  allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <BotsLogsClient initialLogs={allLogs.slice(0, MAX_INITIAL)} bots={bots} />
    </div>
  )
}
