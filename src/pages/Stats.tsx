import { useMemo, useState, type ReactNode } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, Beef, Dumbbell, Flame, Footprints, Heart, Moon, Timer, Trophy } from 'lucide-react'
import { Empty, PageHeader, Panel, SectionTitle, Segmented, Stat, tc } from '../components/ui'
import { Heatmap } from '../components/Heatmap'
import { dayKey, fmtDate, fmtNum, relDay } from '../lib/format'
import { useCheckins, useTypes, useWorkouts } from '../lib/hooks'
import { exerciseHistory, personalRecords, weeklyBuckets, workoutDuration, workoutVolume } from '../lib/stats'

const RANGES = [
  { value: 4, label: '4W' },
  { value: 12, label: '12W' },
  { value: 26, label: '6M' },
  { value: 52, label: '1Y' },
]

const SURFACE = '#0c0f16'
const axis = { stroke: 'transparent', tickLine: false, axisLine: false } as const

export default function Stats() {
  const types = useTypes()
  const all = useWorkouts() ?? []
  const checkins = useCheckins()
  const [weeks, setWeeks] = useState(12)

  const since = Date.now() - weeks * 7 * 86400000
  const workouts = all.filter(w => new Date(w.date).getTime() >= since)
  const cis = checkins.filter(c => new Date(c.date).getTime() >= since)

  const buckets = useMemo(() => weeklyBuckets(all, types, weeks), [all, types, weeks])
  const history = useMemo(() => exerciseHistory(all), [all])
  const exerciseKeys = [...history.keys()].filter(k => (history.get(k)?.points.length ?? 0) > 0)
  const [exKey, setExKey] = useState<string>('')
  const selectedEx = history.get(exKey || exerciseKeys[0])
  const prs = personalRecords(all)

  const totalSec = workouts.reduce((a, w) => a + (workoutDuration(w) ?? 0), 0)
  const totalCal = workouts.reduce((a, w) => a + (w.garmin?.calories ?? 0), 0)
  const withHr = workouts.filter(w => w.garmin?.avgHr)
  const avgHr = withHr.length ? withHr.reduce((a, w) => a + w.garmin!.avgHr!, 0) / withHr.length : undefined
  const withDur = workouts.filter(w => workoutDuration(w))
  const avgMin = withDur.length ? totalSec / withDur.length / 60 : undefined
  const volume = workouts.reduce((a, w) => a + workoutVolume(w), 0)

  const split = types.map(t => ({ name: t.name, code: t.code, color: tc(t).hex, value: workouts.filter(w => w.typeId === t.id).length }))

  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
    d, n: workouts.filter(w => (new Date(w.date).getDay() + 6) % 7 === i).length,
  }))

  const sleep = cis.filter(c => c.sleepHours).map(c => ({ date: c.date, label: fmtDate(c.date), h: c.sleepHours! })).reverse().slice(-42)
  const weight = cis.filter(c => c.bodyweight).map(c => ({ date: c.date, label: fmtDate(c.date), kg: c.bodyweight! })).reverse()
  // Rates are over days you actually checked in, so skipped days don't count against you
  const proteinRate = cis.filter(c => c.protein).length / Math.max(1, cis.length)
  const walkRate = cis.filter(c => c.walk).length / Math.max(1, cis.length)
  const avgSleep = sleep.length ? sleep.reduce((a, b) => a + b.h, 0) / sleep.length : undefined

  if (!all.length && !checkins.length) {
    return (
      <>
        <PageHeader kicker="Analytics" title="Stats" />
        <Empty icon={<Activity />} title="Nothing to crunch yet" body="Log a few workouts and daily check-ins and your trends, PRs and habits will light up here." />
      </>
    )
  }

  return (
    <>
      <PageHeader kicker="Analytics" title="Stats" right={<div className="w-56"><Segmented value={weeks} options={RANGES} onChange={setWeeks} /></div>} />

      <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Sessions" value={workouts.length} accent="text-cyan glow-cyan" icon={<Dumbbell size={14} />} sub={`${(workouts.length / weeks).toFixed(1)} / week`} />
        <Stat label="Time trained" value={totalSec / 3600} digits={1} unit="hrs" icon={<Timer size={14} />} />
        <Stat label="Calories" value={totalCal} unit="kcal" accent="text-pink glow-pink" icon={<Flame size={14} />} />
        <Stat label="Avg session" value={avgMin} unit="min" icon={<Timer size={14} />} />
        <Stat label="Avg HR" value={avgHr} unit="bpm" icon={<Heart size={14} />} />
        <Stat label="Volume" value={volume / 1000} digits={1} unit="t" accent="text-lime glow-lime" icon={<Dumbbell size={14} />} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
        <ChartCard title="Sessions per week" legend={split.map(s => ({ label: s.code, color: s.color }))}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets} margin={{ top: 8, right: 4, left: -28, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip content={<Tip rows={types.map(t => ({ key: t.id, label: t.code, color: tc(t).hex }))} />} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              {types.map((t, i) => (
                <Bar key={t.id} dataKey={t.id} stackId="a" fill={tc(t).hex} stroke={SURFACE} strokeWidth={2}
                  radius={i === types.length - 1 ? [4, 4, 0, 0] : 0} animationDuration={900} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Workout split">
          {workouts.length ? (
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={split} dataKey="value" nameKey="code" innerRadius={62} outerRadius={88} paddingAngle={3} stroke={SURFACE} strokeWidth={2} animationDuration={900}>
                    {split.map(s => <Cell key={s.code} fill={s.color} />)}
                  </Pie>
                  <Tooltip content={<Tip rows={[{ key: 'value', label: 'Sessions' }]} nameKey="name" />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><div className="font-display text-3xl tabular">{workouts.length}</div><div className="font-mono text-[10px] uppercase tracking-widest text-dim">sessions</div></div>
              </div>
              <div className="mt-1 flex justify-center gap-4">
                {split.map(s => (
                  <div key={s.code} className="flex items-center gap-1.5 text-xs text-mute">
                    <span className="size-2.5 rounded-sm" style={{ background: s.color }} />{s.code} <span className="tabular text-ink">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <NoData />}
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ChartCard title="Calories burned per week">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={buckets} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="calg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ff2bd6" stopOpacity={0.4} />
                  <stop offset="1" stopColor="#ff2bd6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
              <YAxis {...axis} allowDecimals={false} />
              <Tooltip content={<Tip rows={[{ key: 'calories', label: 'kcal', color: '#ff2bd6' }]} />} cursor={{ stroke: 'rgb(255 255 255 / 0.2)' }} />
              <Area type="monotone" dataKey="calories" stroke="#ff2bd6" strokeWidth={2} fill="url(#calg)" activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Minutes trained per week">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={buckets} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ming" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#00f0ff" stopOpacity={0.35} />
                  <stop offset="1" stopColor="#00f0ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
              <YAxis {...axis} />
              <Tooltip content={<Tip rows={[{ key: 'minutes', label: 'min', color: '#00f0ff' }]} />} cursor={{ stroke: 'rgb(255 255 255 / 0.2)' }} />
              <Area type="monotone" dataKey="minutes" stroke="#00f0ff" strokeWidth={2} fill="url(#ming)" activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <SectionTitle>Strength progress</SectionTitle>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Panel className="p-5">
          {exerciseKeys.length ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <select className="field max-w-xs" value={exKey || exerciseKeys[0]} onChange={e => setExKey(e.target.value)}>
                  {exerciseKeys.map(k => <option key={k} value={k}>{history.get(k)!.name}</option>)}
                </select>
                {selectedEx && (
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-dim">Est. 1RM</div>
                    <div className="font-display text-2xl text-lime glow-lime tabular">{Math.max(...selectedEx.points.map(p => p.e1rm))}<span className="ml-1 text-xs text-mute">kg</span></div>
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={selectedEx?.points.map(p => ({ ...p, label: fmtDate(p.date) }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis {...axis} domain={[(m: number) => Math.floor((m - 5) / 10) * 10, (m: number) => Math.ceil((m + 5) / 10) * 10]} allowDecimals={false} />
                  <Tooltip content={<Tip rows={[{ key: 'e1rm', label: 'Est. 1RM kg', color: '#b6ff3b' }, { key: 'weight', label: 'Top set kg' }, { key: 'reps', label: 'Reps' }]} />} cursor={{ stroke: 'rgb(255 255 255 / 0.2)' }} />
                  <Line type="monotone" dataKey="e1rm" stroke="#b6ff3b" strokeWidth={2} dot={{ r: 4, fill: '#b6ff3b', stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={1000} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : <NoData text="Log weights and reps to track strength over time." />}
        </Panel>

        <Panel className="max-h-[330px] overflow-y-auto p-2">
          <div className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">Personal records</div>
          {prs.length === 0 && <div className="p-6 text-center text-sm text-mute">No PRs yet.</div>}
          {prs.map(p => (
            <div key={p.name} className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/[0.03]">
              <Trophy size={16} className="shrink-0 text-pink" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{p.name}</div>
                <div className="font-mono text-[10px] text-dim">{relDay(p.date)} · e1RM {p.e1rm}kg</div>
              </div>
              <div className="font-display text-sm tabular">{p.weight}×{p.reps}</div>
            </div>
          ))}
        </Panel>
      </div>

      <SectionTitle>Habits & recovery</SectionTitle>
      <div className="stagger grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Protein hit" value={Math.round(proteinRate * 100)} unit="%" accent="text-pink" icon={<Beef size={14} />} sub="of logged days" />
        <Stat label="Walks" value={Math.round(walkRate * 100)} unit="%" accent="text-lime" icon={<Footprints size={14} />} sub="of logged days" />
        <Stat label="Avg sleep" value={avgSleep} digits={1} unit="h" accent="text-cyan" icon={<Moon size={14} />} />
        <Stat label="Bodyweight" value={weight.at(-1)?.kg} digits={1} unit="kg" icon={<Activity size={14} />}
          sub={weight.length > 1 ? `${(weight.at(-1)!.kg - weight[0].kg) >= 0 ? '+' : ''}${(weight.at(-1)!.kg - weight[0].kg).toFixed(1)}kg in range` : undefined} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ChartCard title="Sleep (hours)">
          {sleep.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sleep} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
                <YAxis {...axis} domain={[0, 10]} />
                <Tooltip content={<Tip rows={[{ key: 'h', label: 'Hours', color: '#00f0ff' }]} />} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
                <Bar dataKey="h" radius={[4, 4, 0, 0]} animationDuration={900}>
                  {sleep.map(s => <Cell key={s.date} fill={s.h >= 7 ? '#00f0ff' : 'rgb(0 240 255 / 0.35)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData text="Log sleep in your daily check-in." />}
          {sleep.length > 0 && <div className="mt-2 font-mono text-[10px] text-dim">Solid bars = 7h+ · faded = under 7h</div>}
        </ChartCard>

        <ChartCard title="Bodyweight (kg)">
          {weight.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weight} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
                <YAxis {...axis} domain={[(m: number) => Math.floor(m - 1), (m: number) => Math.ceil(m + 1)]} allowDecimals={false} />
                <Tooltip content={<Tip rows={[{ key: 'kg', label: 'kg', color: '#ff2bd6' }]} />} cursor={{ stroke: 'rgb(255 255 255 / 0.2)' }} />
                <Line type="monotone" dataKey="kg" stroke="#ff2bd6" strokeWidth={2} dot={{ r: 4, fill: '#ff2bd6', stroke: SURFACE, strokeWidth: 2 }} animationDuration={1000} />
              </LineChart>
            </ResponsiveContainer>
          ) : <NoData text="Add bodyweight in your daily check-in." />}
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
        <ChartCard title="Favourite training days">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dow} margin={{ top: 8, right: 4, left: -28, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} />
              <XAxis dataKey="d" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip content={<Tip rows={[{ key: 'n', label: 'Sessions', color: '#00f0ff' }]} labelKey="d" />} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar dataKey="n" fill="#00f0ff" radius={[4, 4, 0, 0]} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Training calendar">
          <Heatmap workouts={all} types={types} weeks={Math.min(weeks, 26)} />
        </ChartCard>
      </div>
      <div className="mt-6 text-center font-mono text-[10px] text-dim">Updated {fmtDate(dayKey(), { day: 'numeric', month: 'long' })} · {fmtNum(all.length)} sessions all time</div>
    </>
  )
}

function ChartCard({ title, children, legend }: { title: string; children: ReactNode; legend?: { label: string; color: string }[] }) {
  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{title}</div>
        {legend && (
          <div className="flex gap-3">
            {legend.map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-xs text-mute">
                <span className="size-2.5 rounded-sm" style={{ background: l.color }} />{l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </Panel>
  )
}

function NoData({ text = 'No data in this range.' }: { text?: string }) {
  return <div className="grid h-48 place-items-center text-center text-sm text-dim">{text}</div>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Tip({ active, payload, rows, labelKey = 'label', nameKey }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-line-2 bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-mute">{nameKey ? d[nameKey] : d[labelKey]}</div>
      {rows.map((r: { key: string; label: string; color?: string }) => (
        <div key={r.key} className="flex items-center gap-2">
          {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} />}
          <span className="text-mute">{r.label}</span>
          <span className="ml-auto pl-3 font-mono tabular text-ink">{fmtNum(d[r.key], 1)}</span>
        </div>
      ))}
    </div>
  )
}
