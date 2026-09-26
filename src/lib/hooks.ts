import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { dayKey } from './format'

export const useTypes = () => useLiveQuery(() => db.types.orderBy('order').toArray(), []) ?? []

export const useWorkouts = () =>
  useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [])

export const useCheckins = () => useLiveQuery(() => db.checkins.orderBy('date').reverse().toArray(), []) ?? []

export const useToday = () => useLiveQuery(() => db.checkins.get(dayKey()), [])

export async function patchCheckin(date: string, patch: Partial<import('../db').CheckIn>) {
  const cur = await db.checkins.get(date)
  await db.checkins.put({ ...(cur ?? { date }), ...patch, date })
}
