import { CHECKLIST_BADGES } from '@/types/checklist'

interface Props {
  unlockedBadges: Record<string, string>
  streak: number
  lifetime: number
}

export default function BadgeGallery({ unlockedBadges, streak, lifetime }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {CHECKLIST_BADGES.map(badge => {
        const unlockedAt = unlockedBadges[badge.id]
        const current = badge.kind === 'streak' ? streak : lifetime
        const progress = Math.min(100, Math.round((current / badge.threshold) * 100))

        return (
          <div
            key={badge.id}
            className="flex flex-col gap-1.5 p-3 rounded-lg"
            style={{
              background: unlockedAt ? 'rgba(245,158,11,0.08)' : 'var(--surface-2)',
              border: unlockedAt ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)',
              opacity: unlockedAt ? 1 : 0.6,
            }}
          >
            <span style={{ color: unlockedAt ? '#f59e0b' : 'var(--text-1)', fontWeight: 700, fontSize: 13 }}>
              {badge.name}
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
              {badge.kind === 'streak' ? `${badge.threshold} Tage Streak` : `${badge.threshold} Tage insgesamt`}
            </span>
            {unlockedAt ? (
              <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                Freigeschaltet am {new Date(unlockedAt).toLocaleDateString('de-DE')}
              </span>
            ) : (
              <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)' }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
