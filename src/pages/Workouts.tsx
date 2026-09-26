import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Dumbbell, Flame, Heart, Pencil, Search, Timer, Trash2, Trophy, Watch } from 'lucide-react'
import { db, type Workout, type WorkoutType } from '../db'
import { Button, Chip, cx, Empty, IconButton, PageHeader, Panel, SectionTitle, tc, TypeBadge, useToast } from '../components/ui'
import { fmtDuration, fmtLong, fmtNum, relDay } from '../lib/format'
import { haptic } from '../lib/haptics'
import { useTypes, useWorkouts } from '../lib/hooks'
import { newPRs, topSet, workoutDuration, workoutReps, workoutSets, workoutVolume } from '../lib/stats'

export default function Workouts() {
  const { id } = useParams()
  const nav = useNavigate()
  const types = useTypes()
  const workouts = useWorkouts()
  const [filter, setFilter] = useState<string>('all')
  const [q, setQ] = useState('')
  const typeById = useMemo(() => new Map(types.map(t => [t.id, t])), [types])

  const list = (workouts ?? []).filter(w =>
    (filter === 'all' || w.typeId === filter) &&
    (!q || [typeById.get(w.typeId)?.name, w.notes, ...w.exercises.map(e => e.name)].join(' ').toLowerCase().includes(q.toLowerCase())),
  )

  // Group by month
  const groups = new Map<string, Workout[]>()
  list.forEach(w => {
    const k = new Date(w.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    groups.set(k, [...(groups.get(k) ?? []), w])
  })

  const selected = workouts?.find(w => w.id === id)

  return (
    <>
      <div className={cx(id && 'hidden md:block')}>
        <PageHeader kicker={`${workouts?.length ?? 0} sessions logged`} title="Workouts" right={<Button onClick={() => nav('/log')}>Log</Button>} />
      </div>

      <div className="grid gap-6 md:grid-cols-[260px_1fr] xl:grid-cols-[360px_1fr]">
        {/* list */}
        <div className={cx(id && 'hidden md:block')}>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input className="field pl-9" placeholder="Search exercises, notes…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
            {types.map(t => <Chip key={t.id} active={filter === t.id} color={tc(t).hex} onClick={() => setFilter(t.id)}>{t.code}</Chip>)}
          </div>

          {list.length === 0 ? (
            <Empty icon={<Dumbbell />} title={workouts?.length ? 'No matches' : 'No workouts yet'} body={workouts?.length ? 'Try a different filter.' : 'Your full training history will live here.'} />
          ) : (
            [...groups].map(([month, ws]) => (
              <div key={month} className="mb-5">
                <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                  <span>{month}</span><span>{ws.length}</span>
                </div>
                <div className="stagger space-y-2">
                  {ws.map(w => {
                    const t = typeById.get(w.typeId)
                    const active = w.id === id
                    return (
                      <Panel
                        key={w.id}
                        onClick={() => nav(`/workouts/${w.id}`, { replace: !!id })}
                        className={cx('flex items-center gap-3 p-3', active && 'border-cyan/40 bg-cyan/[0.04]')}
                      >
                        <TypeBadge type={t} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-display text-sm">{t?.name}</div>
                          <div className="font-mono text-[10px] text-dim">{new Date(w.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                        </div>
                        <div className="text-right font-mono text-[11px] text-mute tabular">
                          <div>{fmtDuration(workoutDuration(w))}</div>
                          <div className="text-dim">{w.garmin?.calories ? `${w.garmin.calories} kcal` : `${workoutSets(w)} sets`}</div>
                        </div>
                      </Panel>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* detail */}
        <div className={cx('min-w-0', !id && 'hidden md:block')}>
          {selected ? (
            <Detail key={selected.id} w={selected} type={typeById.get(selected.typeId)} all={workouts ?? []} />
          ) : (
            <Panel className="sticky top-8 grid h-80 place-items-center text-center text-sm text-mute">
              <div>
                <Dumbbell className="mx-auto mb-3 text-dim" />
                Select a session to see the details
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

function Detail({ w, type, all }: { w: Workout; type?: WorkoutType; all: Workout[] }) {
  const nav = useNavigate()
  const toast = useToast()
  const c = tc(type)
  const prs = newPRs(w, all)
  const prNames = new Set(prs.map(p => p.name))
  const g = w.garmin
  const zones = g?.hrZonesSec?.filter(z => z > 0)
  const zoneTotal = zones?.reduce((a, b) => a + b, 0) ?? 0
  const ZONE_COLORS = ['#4b556b', '#00f0ff', '#b6ff3b', '#ffb020', '#ff2bd6', '#ff4d6d']

  async function remove() {
    if (!confirm('Delete this workout? This cannot be undone.')) return
    await db.workouts.delete(w.id)
    haptic.warn()
    toast('Workout deleted')
    nav('/workouts', { replace: true })
  }

  return (
    <div className="page-enter md:sticky md:top-8">
      <div className="mb-4 flex items-center gap-2 md:hidden">
        <IconButton label="Back" onClick={() => nav('/workouts')}><ArrowLeft size={18} /></IconButton>
      </div>

      <Panel className="clip-corner overflow-hidden p-6" style={{ boxShadow: `inset 0 0 0 1px ${c.hex}33` }}>
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full blur-3xl" style={{ background: c.soft }} />
        <div className="relative flex items-start gap-4">
          <TypeBadge type={type} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{relDay(w.date)}</div>
            <div className={cx('font-display text-2xl font-semibold md:text-3xl', c.text, c.glow)}>{type?.name}</div>
            <div className="mt-1 text-sm text-mute">{fmtLong(w.date)} · {new Date(w.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div className="flex gap-2">
            <IconButton label="Edit" onClick={() => nav(`/log/${w.id}`)}><Pencil size={16} /></IconButton>
            <IconButton label="Delete" onClick={remove} className="hover:text-red"><Trash2 size={16} /></IconButton>
          </div>
        </div>

        <div className="stagger relative mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Big icon={<Timer size={14} />} label="Duration" value={fmtDuration(workoutDuration(w))} />
          <Big icon={<Flame size={14} />} label="Calories" value={g?.calories ? fmtNum(g.calories) : '—'} unit="kcal" />
          <Big icon={<Heart size={14} />} label="Avg / Max HR" value={g?.avgHr ? `${g.avgHr}${g.maxHr ? ' / ' + g.maxHr : ''}` : '—'} unit="bpm" />
          <Big icon={<Dumbbell size={14} />} label="Volume" value={fmtNum(workoutVolume(w))} unit="kg" />
        </div>

        {zones && zoneTotal > 0 && (
          <div className="relative mt-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">Heart-rate zones</div>
            <div className="flex h-2.5 overflow-hidden rounded-full">
              {g!.hrZonesSec!.map((z, i) => z > 0 && (
                <div key={i} style={{ width: `${(z / zoneTotal) * 100}%`, background: ZONE_COLORS[i] ?? '#fff' }} title={`Zone ${i}: ${fmtDuration(z)}`} />
              ))}
            </div>
          </div>
        )}

        <div className="relative mt-4 flex flex-wrap gap-2 font-mono text-[11px] text-mute">
          <span className="rounded-full bg-white/5 px-3 py-1">{workoutSets(w)} sets</span>
          <span className="rounded-full bg-white/5 px-3 py-1">{workoutReps(w)} reps</span>
          {w.rpe && <span className="rounded-full bg-pink/10 px-3 py-1 text-pink">RPE {w.rpe}</span>}
          {g && <span className="flex items-center gap-1 rounded-full bg-cyan/10 px-3 py-1 text-cyan"><Watch size={12} /> {g.source === 'fit' ? 'Garmin FIT' : g.source === 'screenshot' ? 'Garmin scan' : 'Manual'}</span>}
          {prs.length > 0 && <span className="flex items-center gap-1 rounded-full bg-pink/15 px-3 py-1 text-pink"><Trophy size={12} /> {prs.length} PR{prs.length > 1 ? 's' : ''}</span>}
        </div>
      </Panel>

      {!g && (
        <Panel className="mt-4 flex items-center gap-3 p-4" onClick={() => nav(`/log/${w.id}`)}>
          <Watch className="text-cyan" size={18} />
          <div className="flex-1 text-sm">No Garmin data yet. <span className="text-mute">Tap to scan a screenshot or import a file.</span></div>
        </Panel>
      )}

      <SectionTitle>Exercises</SectionTitle>
      <div className="stagger space-y-2">
        {w.exercises.map((ex, i) => {
          const top = topSet(ex)
          return (
            <Panel key={i} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate font-display">
                    {ex.name}
                    {prNames.has(ex.name) && <Trophy size={14} className="shrink-0 text-pink drop-shadow-[0_0_6px_#ff2bd6]" />}
                  </div>
                  {ex.target && <div className="font-mono text-[10px] text-dim">Target {ex.target}</div>}
                </div>
                {top && <div className="shrink-0 font-display text-sm tabular text-mute">Top {top.weight}kg × {top.reps}</div>}
              </div>
              {ex.sets.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ex.sets.map((s, si) => (
                    <span key={si} className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs tabular">
                      {ex.kind === 'time' ? `${s.seconds ?? '–'}s${s.weight ? ` @${s.weight}kg` : ''}` : `${s.weight != null ? s.weight + 'kg × ' : ''}${s.reps ?? '–'}`}
                    </span>
                  ))}
                </div>
              ) : <div className="mt-2 text-xs text-dim">Not logged</div>}
            </Panel>
          )
        })}
      </div>

      {w.notes && (
        <>
          <SectionTitle>Notes</SectionTitle>
          <Panel className="whitespace-pre-wrap p-4 text-sm text-mute">{w.notes}</Panel>
        </>
      )}
      <div className="h-6" />
      <Button variant="outline" className="w-full md:hidden" onClick={() => nav(`/log/${w.id}`)} icon={<Pencil size={14} />}>Edit workout</Button>
    </div>
  )
}

function Big({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-line bg-black/20 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">{icon}{label}</div>
      <div className="mt-1 font-display text-xl tabular">
        {value}{unit && value !== '—' && <span className="ml-1 font-mono text-[10px] text-mute">{unit}</span>}
      </div>
    </div>
  )
}
