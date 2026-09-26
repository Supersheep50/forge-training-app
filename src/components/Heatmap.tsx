import type { Workout, WorkoutType } from '../db'
import { dayKey, startOfWeek } from '../lib/format'
import { tc } from './ui'

/** GitHub-style training calendar: one column per week, coloured by workout type. */
export function Heatmap({ workouts, types, weeks = 16 }: { workouts: Workout[]; types: WorkoutType[]; weeks?: number }) {
  const byDay = new Map<string, Workout>()
  workouts.forEach(w => byDay.set(dayKey(w.date), w))
  const typeById = new Map(types.map(t => [t.id, t]))
  const start = new Date(startOfWeek(new Date()).getTime() - (weeks - 1) * 7 * 86400000)
  const today = dayKey()

  const cols = Array.from({ length: weeks }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const d = new Date(start)
      d.setDate(start.getDate() + wi * 7 + di)
      return d
    }),
  )

  return (
    <div className="flex gap-3">
      <div className="grid grid-rows-7 gap-[5px] pt-5 font-mono text-[9px] text-dim">
        {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => <div key={i} className="grid h-full place-items-center">{l}</div>)}
      </div>
      <div className="flex min-w-0 flex-1 gap-[5px] overflow-x-auto no-scrollbar">
        {cols.map((col, ci) => (
          <div key={ci} className="flex min-w-[14px] max-w-[26px] flex-1 flex-col gap-[5px]">
            <div className="h-4 font-mono text-[9px] text-dim">
              {col[0].getDate() <= 7 ? col[0].toLocaleDateString('en-GB', { month: 'short' }) : ''}
            </div>
            {col.map(d => {
              const k = dayKey(d)
              const w = byDay.get(k)
              const future = k > today
              const c = w ? tc(typeById.get(w.typeId)).hex : undefined
              return (
                <div
                  key={k}
                  title={`${d.toDateString()}${w ? ' · ' + (typeById.get(w.typeId)?.code ?? '') : ''}`}
                  className="aspect-square rounded-[4px] transition-transform hover:scale-125"
                  style={{
                    background: c ?? (future ? 'transparent' : 'rgb(255 255 255 / 0.05)'),
                    boxShadow: c ? `0 0 10px -1px ${c}` : k === today ? 'inset 0 0 0 1px rgb(0 240 255 / 0.6)' : undefined,
                    border: future ? '1px dashed rgb(255 255 255 / 0.05)' : undefined,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
