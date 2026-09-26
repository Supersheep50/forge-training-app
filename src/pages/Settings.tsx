import { useRef, useState } from 'react'
import { Download, Smartphone, Upload, Vibrate } from 'lucide-react'
import { db } from '../db'
import { SEED_TYPES } from '../seed'
import { Button, PageHeader, Panel, SectionTitle, Toggle, useToast } from '../components/ui'
import { exportBackup, importBackup } from '../lib/files'
import { haptic, hapticsEnabled, setHapticsEnabled } from '../lib/haptics'
import { useLiveQuery } from 'dexie-react-hooks'

export default function SettingsPage() {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [haptics, setH] = useState(hapticsEnabled())
  const counts = useLiveQuery(async () => ({
    workouts: await db.workouts.count(), photos: await db.photos.count(), checkins: await db.checkins.count(),
  }), [])

  return (
    <>
      <PageHeader kicker="System" title="Settings" />

      <SectionTitle>Feel</SectionTitle>
      <Panel className="flex items-center gap-4 p-5">
        <Vibrate className="text-cyan" />
        <div className="flex-1">
          <div className="font-display">Haptic feedback</div>
          <div className="text-xs text-mute">Buzzes on taps, completed sets, PRs and rest timer</div>
        </div>
        <Toggle on={haptics} onChange={v => { setHapticsEnabled(v); setH(v); if (v) haptic.success() }} />
      </Panel>
      <Panel className="mt-3 flex items-center gap-4 p-5">
        <Smartphone className="text-pink" />
        <div className="flex-1">
          <div className="font-display">Replay intro</div>
          <div className="text-xs text-mute">Shows once per app launch</div>
        </div>
        <Button variant="outline" onClick={() => { try { sessionStorage.removeItem('forge.booted') } catch { /* ignore */ } location.reload() }}>Play</Button>
      </Panel>

      <SectionTitle>Your data</SectionTitle>
      <Panel className="p-5">
        <p className="text-sm text-mute">
          Everything lives on this device: {counts?.workouts ?? 0} workouts, {counts?.photos ?? 0} photos, {counts?.checkins ?? 0} check-ins.
          Export a backup now and then (save it to Google Drive) so a phone reset can't wipe your history.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={<Download size={16} />} onClick={async () => { await exportBackup(); toast('Backup downloaded') }}>Export backup</Button>
          <Button variant="outline" icon={<Upload size={16} />} onClick={() => file.current?.click()}>Restore backup</Button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async e => {
          const f = e.target.files?.[0]
          if (!f) return
          try {
            const r = await importBackup(f)
            haptic.success()
            toast(`Restored ${r.workouts} workouts, ${r.photos} photos`)
          } catch (err) { toast((err as Error).message, 'err') }
          e.target.value = ''
        }} />
      </Panel>

      <SectionTitle>Danger zone</SectionTitle>
      <Panel className="flex flex-wrap items-center gap-3 p-5">
        <div className="flex-1 text-sm text-mute">Reset programme to the original Level 2 templates.</div>
        <Button variant="danger" onClick={async () => {
          if (!confirm('Reset all three workout templates? Logged workouts are kept.')) return
          await db.types.bulkPut(SEED_TYPES)
          toast('Programme reset')
        }}>Reset programme</Button>
      </Panel>

      <div className="mt-10 text-center font-mono text-[10px] tracking-widest text-dim">FORGE v1.0 · built for Galaxy Z Fold6</div>
    </>
  )
}
