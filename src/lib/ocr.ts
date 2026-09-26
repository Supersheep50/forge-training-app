import { createWorker } from 'tesseract.js'
import type { ExerciseKind, GarminData, TemplateExercise } from '../db'
import { uid } from '../db'

/** Runs free, on-device OCR over one or more images and returns the combined text. */
export async function readText(files: File[], onProgress?: (p: number) => void): Promise<string> {
  const worker = await createWorker('eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress)
    },
  })
  try {
    const out: string[] = []
    for (const f of files) {
      const { data } = await worker.recognize(await prepare(f))
      out.push(data.text)
    }
    return out.join('\n')
  } finally {
    await worker.terminate()
  }
}

/**
 * Upscale + greyscale + invert dark screenshots: Tesseract reads dark-on-light text
 * far more reliably than Garmin's light-on-dark UI.
 */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file)
  const scale = bmp.width < 1400 ? 2 : 1
  const c = document.createElement('canvas')
  c.width = bmp.width * scale
  c.height = bmp.height * scale
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  let lum = 0
  for (let i = 0; i < d.length; i += 4 * 16) lum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  const dark = lum / (d.length / (4 * 16)) < 110
  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    if (dark) g = 255 - g
    g = g > 170 ? 255 : g < 90 ? 0 : g
    d[i] = d[i + 1] = d[i + 2] = g
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// ---------- Garmin summary parsing ----------

const TIME_RE = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/
const NUM_RE = /(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)/

function toNumber(s: string) {
  return Number(s.replace(/,(?=\d{3}\b)/g, '').replace(/\.(?=\d{3}\b)/g, ''))
}

function toSeconds(m: RegExpMatchArray) {
  const [a, b, c] = [Number(m[1]), Number(m[2]), m[3] != null ? Number(m[3]) : undefined]
  return c != null ? a * 3600 + b * 60 + c : a * 60 + b // "45:32" = mm:ss
}

/** Find a value that sits on the same line as a label, or on the line just above/below it. */
function near(lines: string[], label: RegExp, value: RegExp, exclude?: RegExp): RegExpMatchArray | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i]) || exclude?.test(lines[i])) continue
    const same = lines[i].replace(label, ' ').match(value)
    if (same) return same
    for (const j of [i - 1, i + 1, i + 2]) {
      const m = lines[j]?.match(value)
      if (m && !/[a-z]{4,}/i.test(lines[j].replace(/bpm|kcal|kg|reps?|sets?|cal/gi, ''))) return m
    }
  }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function findDate(text: string): Date | undefined {
  const t = text.toLowerCase()
  // "24 Sep 2026" / "24 September"
  let m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/)
  if (m) return mk(Number(m[1]), MONTHS.indexOf(m[2]), m[3])
  // "Sep 24, 2026"
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/)
  if (m) return mk(Number(m[2]), MONTHS.indexOf(m[1]), m[3])
  // "24/09/2026"
  m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/)
  if (m) return mk(Number(m[1]), Number(m[2]) - 1, m[3].length === 2 ? '20' + m[3] : m[3])
  if (/\btoday\b/.test(t)) return new Date()
  if (/\byesterday\b/.test(t)) return new Date(Date.now() - 86400000)

  function mk(day: number, month: number, year?: string) {
    const now = new Date()
    const d = new Date(year ? Number(year) : now.getFullYear(), month, day, 12)
    if (!year && d > now) d.setFullYear(d.getFullYear() - 1)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
}

function findStartTime(text: string): { h: number; m: number } | undefined {
  const m = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i) ?? text.match(/\b@\s*(\d{1,2}):(\d{2})\b/)
  if (!m) return
  let h = Number(m[1])
  if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12
  if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0
  return { h, m: Number(m[2]) }
}

export interface ScannedSet {
  exercise: string
  reps?: number
  weight?: number
  seconds?: number
}

export interface GarminScan {
  data: GarminData
  date?: Date
  sets: ScannedSet[]
  text: string
}

export function parseGarminText(text: string): GarminScan {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const data: GarminData = { source: 'screenshot' }

  const t = near(lines, /(total|elapsed|moving|workout)?\s*time|duration/i, TIME_RE, /rest|avg|pace|best/i)
  if (t) data.durationSec = toSeconds(t)

  const cal = near(lines, /calories|kcal|\bcal\b/i, NUM_RE, /rate|resting|bmr/i)
  if (cal) data.calories = toNumber(cal[1])

  const avg = near(lines, /av(g|erage)\.?\s*(hr|heart)/i, /\b(\d{2,3})\b/)
  if (avg) data.avgHr = Number(avg[1])

  const max = near(lines, /max(imum)?\.?\s*(hr|heart)/i, /\b(\d{2,3})\b/)
  if (max) data.maxHr = Number(max[1])

  const sets = near(lines, /(total\s*)?sets\b/i, /\b(\d{1,3})\b/, /reps|x\s*\d/i)
  if (sets) data.totalSets = Number(sets[1])

  const reps = near(lines, /(total\s*)?reps\b/i, /\b(\d{1,4})\b/, /sets|x\s*\d|kg/i)
  if (reps) data.totalReps = Number(reps[1])

  const vol = near(lines, /volume|total\s*weight|lifted/i, NUM_RE)
  if (vol) data.volumeKg = Math.round(toNumber(vol[1]))

  const date = findDate(text)
  const st = findStartTime(text)
  if (date && st) date.setHours(st.h, st.m, 0, 0)
  if (date) data.startTime = date.toISOString()

  return { data, date, sets: parseSetLines(lines), text }
}

/** Lines like "8 reps × 60 kg", "8 x 60kg", "60 kg × 8", "0:30" under an exercise heading. */
function parseSetLines(lines: string[]): ScannedSet[] {
  const out: ScannedSet[] = []
  let current = ''
  for (const line of lines) {
    const repsKg = line.match(/(\d{1,3})\s*(?:reps?)?\s*[x×*@]\s*(\d{1,3}(?:\.\d+)?)\s*kg/i)
    const kgReps = line.match(/(\d{1,3}(?:\.\d+)?)\s*kg\s*[x×*]\s*(\d{1,3})/i)
    const repsOnly = line.match(/^\D{0,4}(\d{1,3})\s*reps?\b/i)
    if (repsKg) out.push({ exercise: current, reps: +repsKg[1], weight: +repsKg[2] })
    else if (kgReps) out.push({ exercise: current, reps: +kgReps[2], weight: +kgReps[1] })
    else if (repsOnly) out.push({ exercise: current, reps: +repsOnly[1] })
    else if (/^[A-Za-z][A-Za-z \-()']{3,}$/.test(line) && !/total|calories|time|heart|avg|max|sets|reps|volume|summary|stats|laps|details/i.test(line)) {
      current = line
    }
  }
  return out.filter(s => s.exercise)
}

// ---------- matching scanned exercise names to programme exercises ----------

const norm = (s: string) =>
  s.toLowerCase()
    .replace(/\b(bb|barbell)\b/g, 'barbell').replace(/\b(db|dumbbell)s?\b/g, 'dumbbell')
    .replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2)

export function similarity(a: string, b: string) {
  const A = new Set(norm(a)), B = new Set(norm(b))
  if (!A.size || !B.size) return 0
  let hit = 0
  A.forEach(w => { if (B.has(w)) hit++ })
  return hit / Math.max(A.size, B.size)
}

export function bestMatch<T extends { name: string }>(name: string, options: T[], threshold = 0.3): T | undefined {
  let best: T | undefined, score = threshold
  for (const o of options) {
    const s = similarity(name, o.name)
    if (s > score) { score = s; best = o }
  }
  return best
}

// ---------- programme screenshot parsing ----------

/** Turns a screenshot of a programme list ("Back Squat - Barbell / 3 sets x 8") into template exercises. */
export function parseProgrammeText(text: string): TemplateExercise[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const out: TemplateExercise[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(\d+)\s*sets?\s*[x×]\s*(\d+(?:\s*-\s*\d+)?)\s*(sec|s\b|secs|seconds)?(.*)$/i)
    if (!m) continue
    // Name = the text line(s) just above
    const nameParts: string[] = []
    for (let j = i - 1; j >= 0 && nameParts.length < 2; j--) {
      if (/sets?\s*[x×]/i.test(lines[j])) break
      if (/[A-Za-z]{3,}/.test(lines[j])) nameParts.unshift(lines[j].replace(/^[^A-Za-z]+/, ''))
    }
    if (!nameParts.length) continue
    const rest = m[4].replace(/^[\s,\-–]+/, '').trim()
    const isTime = !!m[3]
    const perSide = /each\s*(leg|side|arm)/i.test(rest)
    const notes = rest.replace(/each\s*(leg|side|arm)/i, '').replace(/^[\s,\-–]+/, '').trim()
    const name = nameParts.join(' ').replace(/\s{2,}/g, ' ')
    const kind: ExerciseKind = isTime ? 'time' : /press up|plank|curl up|ring|suspension|pull up|chin/i.test(name) ? 'reps' : 'weight'
    out.push({
      id: uid(), name, sets: Number(m[1]),
      target: m[2].replace(/\s/g, '') + (isTime ? 'sec' : ''),
      kind, perSide: perSide || undefined, notes: notes || undefined,
    })
  }
  return out
}
