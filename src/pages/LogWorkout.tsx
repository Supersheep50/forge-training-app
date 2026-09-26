import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Check, ChevronDown, Plus, Save, Timer, Trash2, X } from 'lucide-react'
import { db, uid, type LoggedExercise, type SetEntry, type Workout, type WorkoutType } from '../db'
import { GarminImport, type GarminApply } from '../components/GarminImport'
import { RestTimer } from '../components/RestTimer'
import { Button, Chip, cx, Field, IconButton, PageHeader, Panel, tc, TypeBadge, useToast } from '../components/ui'
import { fmtClock, toLocalInput } from '../lib/format'
import { haptic } from '../lib/haptics'
import { useTypes, useWorkouts } from '../lib/hooks'
import { lastOfType, newPRs, nextType } from '../lib/stats'

const DRAFT_KEY = 'forge.draft'
const REST_KEY = 'forge.rest'

interface Draft {
  id?: string
  typeId: string
  date: string
  exercises: LoggedExercise[]
  garmin?: Workout['garmin']
  rpe?: number
  notes?: string
  startedAt: number
}

function fromTemplate(t: WorkoutType): LoggedExercise[] {
  return t.exercises.map(e => ({
    templateId: e.id, name: e.name, kind: e.kind, target: `${e.sets} × ${e.target}${e.perSide ? ' each' : ''}`,
    sets: Array.from({ length: e.sets }, () => ({ done: false })),
  }))
}

const readLS = <T,>(k: string): T | undefined => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : undefined } catch { return undefined }
}
const writeLS = (k: string, v: unknown) => {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ }
}

export default function LogWorkout() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const types = useTypes()
  const workouts = useWorkouts()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)
  const [restSecs, setRestSecs] = useState<number>(() => readLS<number>(REST_KEY) ?? 90)
  const [now, setNow] = useState(Date.now())
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const [saving, setSaving] = useState(false)
  const initialised = useRef(false)

  // Initialise: edit existing → resume draft → new from ?type= or rotation
  useEffect(() => {
    if (initialised.current || !types.length || !workouts) return
    initialised.current = true
    if (id) {
      db.workouts.get(id).then(w => {
        if (!w) return nav('/log', { replace: true })
        setDraft({ id: w.id, typeId: w.typeId, date: w.date, exercises: w.exercises, garmin: w.garmin, rpe: w.rpe, notes: w.notes, startedAt: Date.now() })
      })
      return
    }
    const saved = readLS<Draft>(DRAFT_KEY)
    const wanted = params.get('type')
    if (saved && !saved.id && (!wanted || wanted === saved.typeId)) {
      setDraft(saved)
      toast('Resumed your in-progress workout')
      return
    }
    const t = types.find(x => x.id === wanted) ?? nextType(workouts, types) ?? types[0]
    setDraft({ typeId: t.id, date: new Date().toISOString(), exercises: fromTemplate(t), startedAt: Date.now() })
  }, [types, workouts, id, params, nav, toast])

  // Autosave new-workout drafts so closing the app mid-session loses nothing
  useEffect(() => { if (draft && !draft.id) writeLS(DRAFT_KEY, draft) }, [draft])
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  const type = types.find(t => t.id === draft?.typeId)
  const c = tc(type)
  const previous = useMemo(() => (draft && workouts ? lastOfType(workouts, draft.typeId, draft.id) : undefined), [draft, workouts])

  if (!draft || !type) return <div className="grid h-64 place-items-center text-mute">Loading…</div>

  const update = (fn: (d: Draft) => Draft) => setDraft(d => (d ? fn(structuredClone(d)) : d))

  const switchType = (t: WorkoutType) => {
    if (t.id === draft.typeId) return
    const touched = draft.exercises.some(e => e.sets.some(s => s.done || s.reps || s.weight))
    if (touched && !confirm('Switch workout type? Sets entered so far will be cleared.')) return
    update(d => ({ ...d, typeId: t.id, exercises: fromTemplate(t) }))
    setOpenIdx(0)
  }

  const setField = (ei: number, si: number, patch: Partial<SetEntry>) =>
    update(d => { Object.assign(d.exercises[ei].sets[si], patch); return d })

  const toggleDone = (ei: number, si: number) => {
    const s = draft.exercises[ei].sets[si]
    const prevSet = previous?.exercises.find(e => e.templateId === draft.exercises[ei].templateId)?.sets[si]
    const willBeDone = !s.done
    update(d => {
      const t = d.exercises[ei].sets[si]
      t.done = willBeDone
      // Ticking an empty row copies last session's numbers
      if (willBeDone && prevSet) {
        t.weight ??= prevSet.weight
        t.reps ??= prevSet.reps
        t.seconds ??= prevSet.seconds
      }
      return d
    })
    if (willBeDone) {
      haptic.success()
      setRest({ endsAt: Date.now() + restSecs * 1000, total: restSecs })
      const ex = draft.exercises[ei]
      const allDone = ex.sets.every((x, i) => (i === si ? true : x.done))
      if (allDone && ei < draft.exercises.length - 1) setTimeout(() => setOpenIdx(ei + 1), 350)
    } else haptic.tap()
  }

  const applyGarmin = ({ data, date, fills }: GarminApply) => {
    update(d => {
      d.garmin = data
      if (date) d.date = date.toISOString()
      fills.forEach((sets, ei) => {
        const ex = d.exercises[ei]
        sets.forEach((s, i) => {
          const row = ex.sets[i] ?? (ex.sets[i] = { done: false })
          if (row.reps == null && row.weight == null && row.seconds == null) Object.assign(row, s, { done: true })
        })
      })
      return d
    })
  }

  async function save() {
    if (!draft || !type) return
    setSaving(true)
    const elapsed = Math.round((Date.now() - draft.startedAt) / 1000)
    const workout: Workout = {
      id: draft.id ?? uid(),
      typeId: draft.typeId,
      date: draft.date,
      exercises: draft.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.done || s.reps || s.weight || s.seconds) })),
      garmin: draft.garmin ?? (draft.id ? undefined : { source: 'manual', durationSec: elapsed > 300 ? elapsed : undefined }),
      rpe: draft.rpe,
      notes: draft.notes?.trim() || undefined,
      createdAt: Date.now(),
    }
    await db.workouts.put(workout)
    const prs = newPRs(workout, workouts ?? [])
    if (!draft.id) writeLS(DRAFT_KEY, null)
    if (prs.length) {
      haptic.pr()
      toast(<span><b className="text-pink">NEW PR</b> · {prs.map(p => `${p.name} ${p.weight}kg×${p.reps}`).join(', ')}</span>, 'pr')
    } else {
      haptic.success()
      toast(draft.id ? 'Workout updated' : 'Workout saved 💪')
    }
    nav(`/workouts/${workout.id}`)
  }

  function discard() {
    if (!confirm(draft?.id ? 'Discard changes?' : 'Discard this workout?')) return
    if (!draft?.id) writeLS(DRAFT_KEY, null)
    haptic.warn()
    nav(draft?.id ? `/workouts/${draft.id}` : '/')
  }

  const doneSets = draft.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)
  const totalSets = draft.exercises.reduce((a, e) => a + e.sets.length, 0)
  const progress = totalSets ? doneSets / totalSets : 0

  return (
    <>
      <PageHeader
        kicker={draft.id ? 'Edit session' : 'Live session'}
        title={<span className={cx(c.text, c.glow)}>{type.name}</span>}
        right={
          <>
            {!draft.id && (
              <div className="hidden items-center gap-2 rounded-xl border border-line px-3 py-2 font-mono text-sm tabular text-mute sm:flex">
                <Timer size={14} className="text-cyan animate-pulse-glow" /> {fmtClock((now - draft.startedAt) / 1000)}
              </div>
            )}
            <IconButton label="Discard" onClick={discard}><X size={18} /></IconButton>
          </>
        }
      />

      {/* progress bar */}
      <div className="mb-6 h-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress * 100}%`, background: c.hex, boxShadow: `0 0 12px ${c.hex}` }} />
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {types.map(t => (
              <Chip key={t.id} active={t.id === draft.typeId} color={tc(t).hex} onClick={() => switchType(t)}>{t.code} · {t.name}</Chip>
            ))}
          </div>

          <div className="stagger mt-4 space-y-3">
            {draft.exercises.map((ex, ei) => {
              const open = openIdx === ei
              const done = ex.sets.filter(s => s.done).length
              const complete = done === ex.sets.length && ex.sets.length > 0
              const prevEx = previous?.exercises.find(e => (e.templateId && e.templateId === ex.templateId) || e.name === ex.name)
              return (
                <Panel key={ei} className={cx('overflow-hidden transition-colors', complete && 'border-lime/30')}>
                  <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => { haptic.select(); setOpenIdx(open ? null : ei) }}>
                    <span
                      className={cx('grid size-9 shrink-0 place-items-center rounded-lg font-mono text-xs transition-all', complete ? 'bg-lime text-bg' : 'bg-white/5 text-mute')}
                      style={complete ? { boxShadow: '0 0 14px -2px #b6ff3b' } : undefined}
                    >
                      {complete ? <Check size={16} strokeWidth={3} className="animate-pop" /> : String(ei + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base">{ex.name}</div>
                      <div className="font-mono text-[11px] text-mute">
                        {ex.target} · {done}/{ex.sets.length} sets
                        {prevEx && <span className="text-dim"> · last {summarise(prevEx)}</span>}
                      </div>
                    </div>
                    <ChevronDown size={18} className={cx('text-dim transition-transform duration-300', open && 'rotate-180')} />
                  </button>

                  <div className={cx('grid transition-all duration-300 ease-out', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                    <div className="overflow-hidden">
                      <div className="border-t border-line px-4 pb-4 pt-3">
                        <div className="mb-2 grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-dim">
                          <span>Set</span>
                          <span>{ex.kind === 'time' ? 'Secs' : 'Kg'}</span>
                          <span>{ex.kind === 'time' ? 'Kg (opt)' : 'Reps'}</span>
                          <span />
                        </div>
                        {ex.sets.map((s, si) => {
                          const p = prevEx?.sets[si]
                          return (
                            <div key={si} className={cx('mb-2 grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 transition-opacity', s.done && 'opacity-80')}>
                              <span className="font-mono text-sm text-mute">{si + 1}</span>
                              {ex.kind === 'time' ? (
                                <>
                                  <NumIn value={s.seconds} placeholder={p?.seconds} onChange={v => setField(ei, si, { seconds: v })} />
                                  <NumIn value={s.weight} placeholder={p?.weight} onChange={v => setField(ei, si, { weight: v })} step="0.5" />
                                </>
                              ) : (
                                <>
                                  <NumIn value={s.weight} placeholder={p?.weight ?? (ex.kind === 'reps' ? 'BW' : undefined)} onChange={v => setField(ei, si, { weight: v })} step="0.5" />
                                  <NumIn value={s.reps} placeholder={p?.reps} onChange={v => setField(ei, si, { reps: v })} />
                                </>
                              )}
                              <button
                                aria-label={s.done ? 'Mark not done' : 'Mark done'}
                                onClick={() => toggleDone(ei, si)}
                                className={cx('pressable grid h-11 place-items-center rounded-xl border transition-all', s.done ? 'border-lime bg-lime text-bg' : 'border-line bg-white/5 text-dim hover:text-ink')}
                                style={s.done ? { boxShadow: '0 0 16px -4px #b6ff3b' } : undefined}
                              >
                                <Check size={18} strokeWidth={3} className={s.done ? 'animate-pop' : ''} />
                              </button>
                            </div>
                          )
                        })}
                        <div className="mt-3 flex gap-2">
                          <Button variant="ghost" className="h-9 text-xs" icon={<Plus size={14} />} onClick={() => update(d => { const last = d.exercises[ei].sets.at(-1); d.exercises[ei].sets.push({ done: false, weight: last?.weight }); return d })}>Set</Button>
                          {ex.sets.length > 1 && (
                            <Button variant="ghost" className="h-9 text-xs" icon={<Trash2 size={14} />} onClick={() => update(d => { d.exercises[ei].sets.pop(); return d })}>Last set</Button>
                          )}
                          {!ex.templateId && (
                            <Button variant="ghost" className="ml-auto h-9 text-xs text-red" onClick={() => update(d => { d.exercises.splice(ei, 1); return d })}>Remove</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>
              )
            })}
          </div>

          <AddExercise onAdd={name => { update(d => { d.exercises.push({ name, kind: 'weight', sets: [{ done: false }, { done: false }, { done: false }] }); return d }); setOpenIdx(draft.exercises.length) }} />
        </div>

        {/* side column */}
        <div className="space-y-4 md:sticky md:top-8 md:self-start">
          <Panel className="p-5">
            <div className="flex items-center gap-3">
              <TypeBadge type={type} />
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">Progress</div>
                <div className="font-display text-2xl tabular">{doneSets}<span className="text-mute">/{totalSets}</span> <span className="text-sm text-mute">sets</span></div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Date & time">
                <input type="datetime-local" className="field" value={toLocalInput(draft.date)} onChange={e => e.target.value && update(d => ({ ...d, date: new Date(e.target.value).toISOString() }))} />
              </Field>
              <Field label={`Rest timer · ${restSecs}s`}>
                <input type="range" min={30} max={240} step={15} value={restSecs} className="w-full accent-cyan"
                  onChange={e => { const v = Number(e.target.value); setRestSecs(v); writeLS(REST_KEY, v) }} />
              </Field>
            </div>
          </Panel>

          <GarminImport value={draft.garmin} exercises={draft.exercises} onApply={applyGarmin} />

          <Panel className="p-5">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-mute">How did it feel?</div>
            <div className="grid grid-cols-5 gap-1.5">
              {[6, 7, 8, 9, 10].map(r => (
                <button key={r} onClick={() => { haptic.select(); update(d => ({ ...d, rpe: d.rpe === r ? undefined : r })) }}
                  className={cx('pressable h-11 rounded-xl border font-display tabular', draft.rpe === r ? 'border-pink bg-pink text-bg shadow-[0_0_16px_-4px_#ff2bd6]' : 'border-line text-mute')}>
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-dim"><span>RPE · Easy</span><span>Max effort</span></div>
            <textarea className="field mt-4 min-h-24 resize-none" placeholder="Notes — how you felt, form cues, anything to remember…" value={draft.notes ?? ''} onChange={e => update(d => ({ ...d, notes: e.target.value }))} />
          </Panel>

          <Button className="h-14 w-full text-base" onClick={save} disabled={saving} icon={<Save size={18} />}>
            {draft.id ? 'Save changes' : 'Finish workout'}
          </Button>
        </div>
      </div>

      {rest && <RestTimer endsAt={rest.endsAt} total={rest.total} onChange={(endsAt, total) => setRest({ endsAt, total })} onClose={() => setRest(null)} />}
    </>
  )
}

function summarise(ex: LoggedExercise) {
  const s = ex.sets.find(x => x.weight || x.reps || x.seconds)
  if (!s) return '—'
  if (ex.kind === 'time') return `${s.seconds ?? '?'}s`
  if (s.weight) return `${s.weight}kg × ${s.reps ?? '?'}`
  return `${s.reps} reps`
}

function NumIn({ value, placeholder, onChange, step = '1' }: { value?: number; placeholder?: number | string; onChange: (v?: number) => void; step?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      className="field h-11 text-center font-display text-lg tabular"
      value={value ?? ''}
      placeholder={placeholder != null ? String(placeholder) : '–'}
      onFocus={e => e.target.select()}
      onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  )
}

function AddExercise({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  if (!open) return (
    <button onClick={() => { haptic.tap(); setOpen(true) }} className="pressable mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-2 text-sm text-mute hover:border-cyan/50 hover:text-cyan">
      <Plus size={16} /> Add exercise
    </button>
  )
  return (
    <form className="mt-3 flex gap-2 animate-rise" onSubmit={e => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(''); setOpen(false) } }}>
      <input autoFocus className="field" placeholder="Exercise name" value={name} onChange={e => setName(e.target.value)} />
      <Button type="submit">Add</Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </form>
  )
}
