import Dexie, { type EntityTable } from 'dexie'
import { SEED_TYPES } from './seed'

/** How an exercise is measured. */
export type ExerciseKind = 'weight' | 'reps' | 'time'

export interface TemplateExercise {
  id: string
  name: string
  sets: number
  target: string // e.g. "8", "10-12", "30sec"
  kind: ExerciseKind
  perSide?: boolean
  notes?: string
}

export interface WorkoutType {
  id: string
  code: string // "W1"
  name: string
  color: 'cyan' | 'pink' | 'lime'
  order: number
  exercises: TemplateExercise[]
}

export interface SetEntry {
  weight?: number // kg
  reps?: number
  seconds?: number
  done: boolean
}

export interface LoggedExercise {
  templateId?: string
  name: string
  kind: ExerciseKind
  target?: string
  sets: SetEntry[]
}

/** Metrics that come from the watch (FIT file, screenshot scan or typed in). */
export interface GarminData {
  source: 'fit' | 'screenshot' | 'manual'
  fileName?: string
  startTime?: string
  durationSec?: number
  activeSec?: number
  calories?: number
  avgHr?: number
  maxHr?: number
  totalSets?: number
  totalReps?: number
  volumeKg?: number
  hrZonesSec?: number[]
}

export interface Workout {
  id: string
  typeId: string
  date: string // ISO datetime
  exercises: LoggedExercise[]
  garmin?: GarminData
  rpe?: number
  notes?: string
  createdAt: number
}

export interface Photo {
  id: string
  date: string // yyyy-mm-dd
  pose: 'front' | 'side' | 'back' | 'other'
  blob: Blob
  note?: string
  weight?: number
}

export interface CheckIn {
  date: string // yyyy-mm-dd (primary key)
  protein?: boolean
  proteinGrams?: number
  walk?: boolean
  walkMinutes?: number
  steps?: number
  sleepHours?: number
  sleepQuality?: number // 1-5
  bodyweight?: number
  mood?: number // 1-5
  water?: boolean
  creatine?: boolean
  notes?: string
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('forge') as Dexie & {
  types: EntityTable<WorkoutType, 'id'>
  workouts: EntityTable<Workout, 'id'>
  photos: EntityTable<Photo, 'id'>
  checkins: EntityTable<CheckIn, 'date'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  types: 'id, order',
  workouts: 'id, typeId, date',
  photos: 'id, date',
  checkins: 'date',
  settings: 'key',
})

db.on('populate', tx => {
  tx.table('types').bulkAdd(SEED_TYPES)
})

export const uid = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return (row?.value as T) ?? fallback
}

export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value })

// Ask the browser not to evict our data under storage pressure.
navigator.storage?.persist?.().catch(() => {})

// Dev-only handle for seeding demo data in automated screenshots.
if (import.meta.env.DEV) (window as unknown as { __db: typeof db }).__db = db
