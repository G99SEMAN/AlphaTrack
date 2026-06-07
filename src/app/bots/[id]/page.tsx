import { getProfiles, getActiveProfile } from '@/lib/profiles'
import { getBotById, getBotStatusWithConnection, getBotLog } from '@/lib/bot-data'
import { redirect, notFound } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BotDetailClient from './BotDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BotDetailPage({ params }: Props) {
  const { id } = await params
  const profiles = getProfiles()
  if (profiles.length === 0) redirect('/setup')

  const activeProfile = getActiveProfile()
  if (!activeProfile) redirect('/setup')

  const bot = getBotById(id)
  if (!bot || bot.type !== 'bot') notFound()

  const status = getBotStatusWithConnection(id)
  const log = getBotLog(id)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar profiles={profiles} activeProfile={activeProfile} />
      <BotDetailClient bot={bot} status={status} log={log} profiles={profiles} />
    </div>
  )
}
