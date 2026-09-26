import { Decoder, Stream } from '@garmin/fitsdk'
import { unzipSync } from 'fflate'
import type { GarminData } from '../db'

export interface FitSet {
  reps?: number
  weight?: number
  durationSec?: number
  category?: string
  startTime?: string
}

export interface FitResult {
  data: GarminData
  sets: FitSet[]
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** Accepts a .fit file or the .zip that Garmin Connect's "Export Original" produces. */
export async function parseGarminFile(file: File): Promise<FitResult> {
  let bytes = new Uint8Array(await file.arrayBuffer())
  let fileName = file.name

  if (/\.zip$/i.test(file.name) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    const entries = unzipSync(bytes)
    const fitName = Object.keys(entries).find(n => /\.fit$/i.test(n))
    if (!fitName) throw new Error('No .fit file found inside the zip.')
    bytes = entries[fitName]
    fileName = fitName
  }

  const stream = Stream.fromArrayBuffer(bytes.slice().buffer)
  if (!Decoder.isFIT(stream)) throw new Error('That file is not a Garmin FIT activity.')
  const decoder = new Decoder(stream)
  const { messages, errors } = decoder.read()
  if (errors.length && !messages?.sessionMesgs?.length) throw new Error(String(errors[0]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = messages.sessionMesgs?.[0] ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSets: any[] = messages.setMesgs ?? []

  const sets: FitSet[] = rawSets
    .filter(x => x.setType === 'active' || x.setType === 1)
    .map(x => ({
      reps: num(x.repetitions),
      weight: num(x.weight),
      durationSec: num(x.duration),
      category: Array.isArray(x.category) ? String(x.category[0] ?? '') : x.category ? String(x.category) : undefined,
      startTime: x.startTime instanceof Date ? x.startTime.toISOString() : undefined,
    }))

  const totalReps = sets.reduce((a, b) => a + (b.reps ?? 0), 0)
  const volume = sets.reduce((a, b) => a + (b.reps ?? 0) * (b.weight ?? 0), 0)

  const zones = Array.isArray(s.timeInHrZone) ? s.timeInHrZone.map((z: unknown) => num(z) ?? 0) : undefined

  const data: GarminData = {
    source: 'fit',
    fileName,
    startTime: s.startTime instanceof Date ? s.startTime.toISOString() : undefined,
    durationSec: num(s.totalElapsedTime),
    activeSec: num(s.totalTimerTime),
    calories: num(s.totalCalories),
    avgHr: num(s.avgHeartRate),
    maxHr: num(s.maxHeartRate),
    totalSets: sets.length || undefined,
    totalReps: totalReps || undefined,
    volumeKg: volume ? Math.round(volume) : undefined,
    hrZonesSec: zones,
  }
  return { data, sets }
}

export const isGarminFile = (f: File) => /\.(fit|zip)$/i.test(f.name)
