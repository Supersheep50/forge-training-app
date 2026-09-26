import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Beef, ChevronLeft, ChevronRight, Droplets, Footprints, Moon, Pill, Scale, Smile } from 'lucide-react'
import { db, type CheckIn } from '../db'
import { cx, Field, PageHeader, Panel, SectionTitle, Toggle } from '../components/ui'
import { dayKey, fmtDate, fmtLong } from '../lib/format'
import { haptic } from '../lib/haptics'
import { patchCheckin, useCheckins } from '../lib/hooks'
import { habitStreak } from '../lib/stats'

export default function CheckInPage() {
  const [date, setDate] = useState(dayKey())
  const entry = useLiveQuery(() => db.checkins.get(date), [date])
  const all = useCheckins()
  const [flash, setFlash] = useState(false)
  const isToday = date === dayKey()

  const patch = async (p: Partial<CheckIn>) => {
    await patchCheckin(date, p)
    setFlash(true)
  }
  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(false), 1200); return () => clearTimeout(t) } }, [flash])

  const shift = (d: number) => {
    const x = new Date(date + 'T12:00')
    x.setDate(x.getDate() + d)
    const k = dayKey(x)
    if (k > dayKey()) return
    haptic.select()
    setDate(k)
  }

  const answered = [entry?.protein != null, entry?.walk != null, entry?.sleepHours != null].filter(Boolean).length

  return (
    <>
      <PageHeader
        kicker={isToday ? 'Today' : fmtLong(date + 'T12:00')}
        title="Daily check-in"
        right={<span className={cx('font-mono text-xs text-lime transition-opacity duration-500', flash ? 'opacity-100' : 'opacity-0')}>✓ Saved</span>}
      />

      <Panel className="mb-6 flex items-center gap-3 p-2">
        <button onClick={() => shift(-1)} className="pressable grid size-11 place-items-center rounded-xl bg-white/5 text-mute" aria-label="Previous day"><ChevronLeft size={18} /></button>
        <div className="flex-1 text-center">
          <div className="font-display text-lg">{isToday ? 'Today' : fmtDate(date + 'T12:00', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{answered}/3 answered</div>
        </div>
        <button onClick={() => shift(1)} disabled={isToday} className="pressable grid size-11 place-items-center rounded-xl bg-white/5 text-mute disabled:opacity-30" aria-label="Next day"><ChevronRight size={18} /></button>
      </Panel>

      <div className="stagger grid gap-4 md:grid-cols-2">
        <Question
          icon={<Beef size={22} />} color="#ff2bd6" question="Did you hit your protein?"
          value={entry?.protein} onAnswer={v => patch({ protein: v })} streak={habitStreak(all, 'protein')}
        >
          <Field label="Grams (optional)">
            <input className="field tabular" type="number" inputMode="numeric" placeholder="e.g. 160" value={entry?.proteinGrams ?? ''}
              onChange={e => patch({ proteinGrams: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </Field>
        </Question>

        <Question
          icon={<Footprints size={22} />} color="#b6ff3b" question="Did you get out for a walk?"
          value={entry?.walk} onAnswer={v => patch({ walk: v })} streak={habitStreak(all, 'walk')}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minutes">
              <input className="field tabular" type="number" inputMode="numeric" placeholder="30" value={entry?.walkMinutes ?? ''}
                onChange={e => patch({ walkMinutes: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </Field>
            <Field label="Steps (Garmin)">
              <input className="field tabular" type="number" inputMode="numeric" placeholder="8000" value={entry?.steps ?? ''}
                onChange={e => patch({ steps: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </Field>
          </div>
        </Question>

        <Panel className="p-5 md:col-span-2">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-cyan/10 text-cyan"><Moon size={22} /></span>
            <div className="flex-1">
              <div className="font-display text-lg">How did you sleep?</div>
              <div className="text-xs text-mute">From your Garmin sleep score screen, or a best guess</div>
            </div>
            <div className="text-right">
              <div className="font-display text-4xl text-cyan glow-cyan tabular">{entry?.sleepHours ?? '–'}<span className="text-base text-mute">h</span></div>
            </div>
          </div>
          <input
            type="range" min={3} max={11} step={0.25} value={entry?.sleepHours ?? 7.5} className="mt-5 w-full accent-cyan"
            onChange={e => { haptic.tap(); patch({ sleepHours: Number(e.target.value) }) }}
          />
          <div className="flex justify-between font-mono text-[10px] text-dim"><span>3h</span><span>7h</span><span>11h</span></div>
          <div className="mt-4 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">Quality</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(q => (
                <button key={q} onClick={() => { haptic.select(); patch({ sleepQuality: q }) }}
                  className={cx('pressable grid size-10 place-items-center rounded-xl border', (entry?.sleepQuality ?? 0) >= q ? 'border-cyan/60 bg-cyan/15 text-cyan' : 'border-line text-dim')}>
                  <Moon size={16} fill={(entry?.sleepQuality ?? 0) >= q ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-mute"><Scale size={20} /></span>
            <div className="font-display text-lg">Bodyweight</div>
          </div>
          <Field label="kg">
            <input className="field font-display text-xl tabular" type="number" inputMode="decimal" step="0.1" placeholder="—" value={entry?.bodyweight ?? ''}
              onChange={e => patch({ bodyweight: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </Field>
        </Panel>

        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-mute"><Smile size={20} /></span>
            <div className="font-display text-lg">Energy & extras</div>
          </div>
          <div className="mb-4 flex gap-1.5">
            {['😵', '😕', '😐', '🙂', '⚡'].map((e, i) => (
              <button key={i} onClick={() => { haptic.select(); patch({ mood: i + 1 }) }}
                className={cx('pressable grid h-11 flex-1 place-items-center rounded-xl border text-xl transition-all', entry?.mood === i + 1 ? 'scale-105 border-amber/60 bg-amber/15' : 'border-line grayscale-[60%] opacity-60')}>
                {e}
              </button>
            ))}
          </div>
          <Extra icon={<Droplets size={16} />} label="Drank enough water" on={!!entry?.water} onChange={v => patch({ water: v })} />
          <Extra icon={<Pill size={16} />} label="Took creatine / supplements" on={!!entry?.creatine} onChange={v => patch({ creatine: v })} />
        </Panel>

        <Panel className="p-5 md:col-span-2">
          <Field label="Notes">
            <textarea className="field min-h-20 resize-none" placeholder="Anything worth remembering about today…" value={entry?.notes ?? ''} onChange={e => patch({ notes: e.target.value })} />
          </Field>
        </Panel>
      </div>

      <SectionTitle>Last 14 days</SectionTitle>
      <Panel className="overflow-x-auto p-5 no-scrollbar">
        <HabitGrid all={all} />
      </Panel>
    </>
  )
}

function Question({ icon, color, question, value, onAnswer, streak, children }: {
  icon: ReactNode; color: string; question: string; value?: boolean; onAnswer: (v: boolean) => void; streak: number; children?: ReactNode
}) {
  return (
    <Panel className="p-5 transition-all duration-500" style={value ? { boxShadow: `inset 0 0 0 1px ${color}55, 0 20px 50px -30px ${color}` } : undefined}>
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl" style={{ background: `${color}1a`, color }}>{icon}</span>
        <div className="flex-1">
          <div className="font-display text-lg leading-tight">{question}</div>
          <div className="font-mono text-[10px] text-dim">{streak > 0 ? `🔥 ${streak}-day streak` : 'Start a streak today'}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {([true, false] as const).map(v => (
          <button
            key={String(v)}
            onClick={() => { v ? haptic.success() : haptic.tap(); onAnswer(v) }}
            className={cx('pressable h-12 rounded-xl border font-display uppercase tracking-wider transition-all', value === v ? 'text-bg' : 'border-line text-mute')}
            style={value === v ? { background: v ? color : '#4b556b', borderColor: v ? color : '#4b556b', boxShadow: v ? `0 0 24px -6px ${color}` : undefined } : undefined}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </Panel>
  )
}

function Extra({ icon, label, on, onChange }: { icon: ReactNode; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-mute">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

function HabitGrid({ all }: { all: CheckIn[] }) {
  const map = new Map(all.map(c => [c.date, c]))
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d
  })
  const rows: { label: string; color: string; test: (c?: CheckIn) => boolean | undefined; value?: (c?: CheckIn) => string }[] = [
    { label: 'Protein', color: '#ff2bd6', test: c => c?.protein },
    { label: 'Walk', color: '#b6ff3b', test: c => c?.walk },
    { label: 'Sleep 7h+', color: '#00f0ff', test: c => (c?.sleepHours ?? 0) >= 7, value: c => (c?.sleepHours ? String(c.sleepHours) : '') },
  ]
  return (
    <div className="min-w-[560px]">
      <div className="grid grid-cols-[80px_repeat(14,1fr)] gap-1.5">
        <span />
        {days.map(d => (
          <span key={d.toISOString()} className={cx('text-center font-mono text-[9px]', dayKey(d) === dayKey() ? 'text-cyan' : 'text-dim')}>
            {d.toLocaleDateString('en-GB', { weekday: 'narrow' })}<br />{d.getDate()}
          </span>
        ))}
        {rows.map(r => (
          <div key={r.label} className="contents">
            <span className="self-center font-mono text-[10px] uppercase tracking-wider text-mute">{r.label}</span>
            {days.map(d => {
              const c = map.get(dayKey(d))
              const hit = r.test(c)
              return (
                <span
                  key={d.toISOString()}
                  className="grid aspect-square place-items-center rounded-md font-mono text-[9px] text-bg"
                  style={{ background: hit ? r.color : c ? 'rgb(255 255 255 / 0.07)' : 'rgb(255 255 255 / 0.025)', boxShadow: hit ? `0 0 10px -2px ${r.color}` : undefined }}
                >
                  {hit && r.value ? r.value(c) : ''}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
