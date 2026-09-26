import { db, type CheckIn, type Photo, type Workout, type WorkoutType } from '../db'

/** Downscale a camera photo so the library stays small on-device. */
export async function compressImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not encode image'))), 'image/jpeg', quality))
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

interface Backup {
  app: 'forge'
  version: 1
  exportedAt: string
  types: WorkoutType[]
  workouts: Workout[]
  checkins: CheckIn[]
  photos: (Omit<Photo, 'blob'> & { data: string })[]
}

export async function exportBackup() {
  const [types, workouts, checkins, photos] = await Promise.all([
    db.types.toArray(), db.workouts.toArray(), db.checkins.toArray(), db.photos.toArray(),
  ])
  const backup: Backup = {
    app: 'forge', version: 1, exportedAt: new Date().toISOString(),
    types, workouts, checkins,
    photos: await Promise.all(photos.map(async ({ blob, ...p }) => ({ ...p, data: await blobToDataUrl(blob) }))),
  }
  const file = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = `forge-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text()) as Backup
  if (data.app !== 'forge') throw new Error('Not a FORGE backup file.')
  const photos: Photo[] = await Promise.all(
    data.photos.map(async ({ data: url, ...p }) => ({ ...p, blob: await (await fetch(url)).blob() })),
  )
  await db.transaction('rw', [db.types, db.workouts, db.checkins, db.photos], async () => {
    await db.types.bulkPut(data.types)
    await db.workouts.bulkPut(data.workouts)
    await db.checkins.bulkPut(data.checkins)
    await db.photos.bulkPut(photos)
  })
  return { workouts: data.workouts.length, photos: photos.length, checkins: data.checkins.length }
}
