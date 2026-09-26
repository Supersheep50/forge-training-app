import type { CheckIn, LoggedExercise, Workout, WorkoutType } from '../db'
import { dayKey, startOfDay, startOfWeek } from './format'

export const setVolume = (ex: LoggedExercise) =>
  ex.sets.reduce((a, s) => a + (s.done || s.reps ? (s.reps ?? 0) * (s.weight ?? 0) : 0), 0)

export const workoutVolume = (w: Workout) =>
  w.exercises.reduce((a, e) => a + setVolume(e), 0) || w.garmin?.volumeKg || 0

export const workoutSets = (w: Workout) =>
  w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done || s.reps || s.seconds).length, 0) || w.garmin?.totalSets || 0

export const workoutReps = (w: Workout) =>
  w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.reps ?? 0), 0), 0) || w.garmin?.totalReps || 0

export const workoutDuration = (w: Workout) => w.garmin?.durationSec ?? w.garmin?.activeSec

/** Estimated 1-rep max (Epley). */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30))

export function topSet(ex: LoggedExercise) {
  let best: { weight: number; reps: number } | undefined
  for (const s of ex.sets) {
    if (!s.weight || !s.reps) continue
    if (!best || e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps)) best = { weight: s.weight, reps: s.reps }
  }
  return best
}

/** Consecutive weeks (ending this week or last) with at least one workout. */
export function weekStreak(workouts: Workout[]) {
  const weeks = new Set(workouts.map(w => startOfWeek(new Date(w.date)).getTime()))
  let cursor = startOfWeek(new Date())
  if (!weeks.has(cursor.getTime())) cursor = new Date(cursor.getTime() - 7 * 86400000)
  let n = 0
  while (weeks.has(cursor.getTime())) {
    n++
    cursor = new Date(cursor.getTime() - 7 * 86400000)
  }
  return n
}

/** Consecutive days (ending today or yesterday) where a check-in flag is true. */
export function habitStreak(checkins: CheckIn[], key: 'protein' | 'walk') {
  const hit = new Set(checkins.filter(c => c[key]).map(c => c.date))
  const d = startOfDay(new Date())
  if (!hit.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (hit.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export interface WeekBucket {
  week: string
  label: string
  total: number
  calories: number
  minutes: number
  volume: number
  [typeId: string]: number | string
}

export function weeklyBuckets(workouts: Workout[], types: WorkoutType[], weeks = 12): WeekBucket[] {
  const start = startOfWeek(new Date())
  const out: WeekBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 7 * 86400000)
    const b: WeekBucket = {
      week: dayKey(d),
      label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      total: 0, calories: 0, minutes: 0, volume: 0,
    }
    types.forEach(t => (b[t.id] = 0))
    out.push(b)
  }
  const idx = new Map(out.map((b, i) => [b.week, i]))
  for (const w of workouts) {
    const i = idx.get(dayKey(startOfWeek(new Date(w.date))))
    if (i == null) continue
    const b = out[i]
    b.total++
    b[w.typeId] = ((b[w.typeId] as number) ?? 0) + 1
    b.calories += w.garmin?.calories ?? 0
    b.minutes += Math.round((workoutDuration(w) ?? 0) / 60)
    b.volume += Math.round(workoutVolume(w))
  }
  return out
}

/** Per-exercise history of best estimated 1RM and top weight, keyed by normalised name. */
export function exerciseHistory(workouts: Workout[]) {
  const map = new Map<string, { name: string; points: { date: string; weight: number; reps: number; e1rm: number }[] }>()
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  for (const w of sorted) {
    for (const ex of w.exercises) {
      const top = topSet(ex)
      if (!top) continue
      const key = (ex.templateId ?? ex.name).toLowerCase()
      const entry = map.get(key) ?? { name: ex.name, points: [] }
      entry.points.push({ date: w.date, weight: top.weight, reps: top.reps, e1rm: Math.round(e1rm(top.weight, top.reps) * 10) / 10 })
      map.set(key, entry)
    }
  }
  return map
}

export interface PR { name: string; weight: number; reps: number; e1rm: number; date: string }

export function personalRecords(workouts: Workout[]): PR[] {
  const out: PR[] = []
  exerciseHistory(workouts).forEach(({ name, points }) => {
    const best = points.reduce((a, b) => (b.e1rm > a.e1rm ? b : a))
    out.push({ name, ...best })
  })
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Did this workout set a new best e1RM for any exercise versus everything before it? */
export function newPRs(workout: Workout, history: Workout[]) {
  const prior = history.filter(w => w.id !== workout.id && w.date < workout.date)
  const hist = exerciseHistory(prior)
  const out: { name: string; weight: number; reps: number }[] = []
  for (const ex of workout.exercises) {
    const top = topSet(ex)
    if (!top) continue
    const past = hist.get((ex.templateId ?? ex.name).toLowerCase())
    const bestPast = past ? Math.max(...past.points.map(p => p.e1rm)) : 0
    if (past && e1rm(top.weight, top.reps) > bestPast + 0.01) out.push({ name: ex.name, ...top })
  }
  return out
}

/** Suggest the next workout in the rotation after the most recent one. */
export function nextType(workouts: Workout[], types: WorkoutType[]) {
  const sorted = [...types].sort((a, b) => a.order - b.order)
  if (!sorted.length) return undefined
  const last = [...workouts].sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!last) return sorted[0]
  const i = sorted.findIndex(t => t.id === last.typeId)
  return sorted[(i + 1) % sorted.length]
}

/** Last time a given workout type was done, for "previous" hints while logging. */
export function lastOfType(workouts: Workout[], typeId: string, excludeId?: string) {
  return [...workouts]
    .filter(w => w.typeId === typeId && w.id !== excludeId)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
}
