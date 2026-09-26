import { useNavigate } from 'react-router'
import { ArrowRight, Beef, Dumbbell, Flame, Footprints, Moon, Timer, Trophy, Zap } from 'lucide-react'
import { Heatmap } from '../components/Heatmap'
import { Panel, PageHeader, SectionTitle, Stat, Toggle, TypeBadge, tc, Button, Empty } from '../components/ui'
import { dayKey, fmtDuration, fmtLong, fmtNum, greeting, relDay, startOfWeek } from '../lib/format'
import { patchCheckin, useCheckins, useToday, useTypes, useWorkouts } from '../lib/hooks'
import { habitStreak, nextType, personalRecords, weekStreak, workoutDuration, workoutVolume } from '../lib/stats'

export default function Dashboard() {
  const nav = useNavigate()
  const types = useTypes()
  const workouts = useWorkouts() ?? []
  const checkins = useCheckins()
  const today = useToday()
  const typeById = new Map(types.map(t => [t.id, t]))

  const next = nextType(workouts, types)
  const nc = tc(next)
  const weekStart = startOfWeek(new Date()).getTime()
  const thisWeek = workouts.filter(w => new Date(w.date).getTime() >= weekStart)
  const monthKey = dayKey().slice(0, 7)
  const monthCals = workouts.filter(w => w.date.startsWith(monthKey)).reduce((a, w) => a + (w.garmin?.calories ?? 0), 0)
  const streak = weekStreak(workouts)
  const prs = personalRecords(workouts).slice(0, 3)
  const doneToday = workouts.some(w => dayKey(w.date) === dayKey())
  const lastOfNext = workouts.find(w => w.typeId === next?.id)

  return (
    <>
      <PageHeader kicker={fmtLong(new Date())} title={<>{greeting()}, <span className="text-cyan glow-cyan">Jon</span></>} />

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        {/* Hero: next workout */}
        <Panel className="clip-corner overflow-hidden p-6" style={{ boxShadow: `inset 0 0 0 1px ${nc.hex}33, 0 30px 60px -30px ${nc.hex}55` }}>
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full blur-3xl" style={{ background: nc.soft }} />
          <div className="relative">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-mute">
              {doneToday ? 'Done today · Up next' : 'Up next'}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <TypeBadge type={next} size="lg" />
              <div>
                <div className={`font-display text-3xl font-semibold ${nc.text} ${nc.glow}`}>{next?.name ?? 'Workout'}</div>
                <div className="mt-1 text-sm text-mute">
                  {next?.exercises.length ?? 0} exercises · {lastOfNext ? `last done ${relDay(lastOfNext.date).toLowerCase()}` : 'not done yet'}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {next?.exercises.slice(0, 4).map(e => (
                <span key={e.id} className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-mute">{e.name}</span>
              ))}
              {(next?.exercises.length ?? 0) > 4 && <span className="px-2 py-1 text-xs text-dim">+{next!.exercises.length - 4} more</span>}
            </div>
            <Button className="mt-6 w-full sm:w-auto" onClick={() => nav(`/log?type=${next?.id}`)} icon={<Zap size={16} />}>
              Start {next?.code}
            </Button>
          </div>
        </Panel>

        {/* Today's habits */}
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-mute">Today's check-in</div>
            <button className="text-xs text-cyan" onClick={() => nav('/checkin')}>Open →</button>
          </div>
          <div className="mt-4 space-y-3">
            <HabitRow icon={<Beef size={18} />} label="Hit protein?" streak={habitStreak(checkins, 'protein')}
              on={!!today?.protein} onChange={v => patchCheckin(dayKey(), { protein: v })} color="#ff2bd6" />
            <HabitRow icon={<Footprints size={18} />} label="Got out for a walk?" streak={habitStreak(checkins, 'walk')}
              on={!!today?.walk} onChange={v => patchCheckin(dayKey(), { walk: v })} color="#b6ff3b" />
            <button onClick={() => nav('/checkin')} className="pressable flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-left">
              <span className="grid size-9 place-items-center rounded-lg bg-white/5 text-cyan"><Moon size={18} /></span>
              <span className="flex-1 text-sm">Sleep last night</span>
              <span className="font-display text-lg tabular">{today?.sleepHours ? `${today.sleepHours}h` : <span className="text-dim text-sm">Log →</span>}</span>
            </button>
          </div>
        </Panel>
      </div>

      <div className="stagger mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="This week" value={thisWeek.length} unit="/ 3" accent="text-cyan glow-cyan" icon={<Dumbbell size={14} />} sub={thisWeek.length >= 3 ? 'Target hit 🔥' : `${3 - thisWeek.length} to go`} />
        <Stat label="Week streak" value={streak} unit="wks" accent="text-pink glow-pink" icon={<Flame size={14} />} sub="Consecutive training weeks" />
        <Stat label="Total sessions" value={workouts.length} icon={<Timer size={14} />} sub={workouts.length ? `Since ${new Date(workouts[workouts.length - 1].date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : 'Log your first'} />
        <Stat label="Kcal this month" value={monthCals} accent="text-lime glow-lime" icon={<Flame size={14} />} sub="From Garmin data" />
      </div>

      <SectionTitle>Training calendar</SectionTitle>
      <Panel className="p-5">
        <Heatmap workouts={workouts} types={types} weeks={20} />
        <div className="mt-4 flex flex-wrap gap-4">
          {types.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs text-mute">
              <span className="size-2.5 rounded-sm" style={{ background: tc(t).hex, boxShadow: `0 0 8px ${tc(t).hex}` }} />
              {t.code} · {t.name}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionTitle right={<button className="text-xs text-cyan" onClick={() => nav('/workouts')}>All →</button>}>Recent sessions</SectionTitle>
          {workouts.length === 0 ? (
            <Empty icon={<Dumbbell />} title="No workouts yet" body="Log your first session and it'll show up here." action={<Button onClick={() => nav('/log')}>Log workout</Button>} />
          ) : (
            <div className="stagger space-y-3">
              {workouts.slice(0, 4).map(w => {
                const t = typeById.get(w.typeId)
                return (
                  <Panel key={w.id} className="flex items-center gap-4 p-4" onClick={() => nav(`/workouts/${w.id}`)}>
                    <TypeBadge type={t} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base">{t?.name ?? 'Workout'}</div>
                      <div className="text-xs text-mute">{relDay(w.date)}</div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="font-display tabular">{fmtDuration(workoutDuration(w))}</div>
                      <div className="font-mono text-[10px] text-dim">{w.garmin?.calories ? `${w.garmin.calories} kcal` : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display tabular">{fmtNum(workoutVolume(w))}<span className="text-xs text-mute"> kg</span></div>
                      <div className="font-mono text-[10px] text-dim">volume</div>
                    </div>
                    <ArrowRight size={16} className="text-dim" />
                  </Panel>
                )
              })}
            </div>
          )}
        </div>
        <div>
          <SectionTitle>Latest PRs</SectionTitle>
          <Panel className="p-2">
            {prs.length === 0 && <div className="p-6 text-center text-sm text-mute">Personal records appear once you log weights.</div>}
            {prs.map(p => (
              <div key={p.name} className="flex items-center gap-3 rounded-xl p-3">
                <span className="grid size-9 place-items-center rounded-lg bg-pink/10 text-pink"><Trophy size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.name}</div>
                  <div className="font-mono text-[10px] text-dim">{relDay(p.date)}</div>
                </div>
                <div className="font-display tabular">{p.weight}kg × {p.reps}</div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  )
}

function HabitRow({ icon, label, on, onChange, streak, color }: { icon: React.ReactNode; label: string; on: boolean; onChange: (v: boolean) => void; streak: number; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 transition-colors" style={on ? { background: `${color}14` } : undefined}>
      <span className="grid size-9 place-items-center rounded-lg bg-white/5" style={{ color }}>{icon}</span>
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {streak > 0 && <div className="font-mono text-[10px] text-dim">{streak}-day streak</div>}
      </div>
      <Toggle on={on} onChange={onChange} color={color} />
    </div>
  )
}
