import { useRef, useState } from 'react'
import { FileUp, Loader2, ScanLine, Watch } from 'lucide-react'
import type { GarminData, LoggedExercise } from '../db'
import { fmtDuration, fmtLong } from '../lib/format'
import type { FitSet } from '../lib/garmin'
import { haptic } from '../lib/haptics'
import { bestMatch, parseGarminText, readText, type ScannedSet } from '../lib/ocr'
import { Button, Field, Panel, Sheet, useToast } from './ui'

export interface GarminApply {
  data: GarminData
  date?: Date
  /** Sets to merge into the logged exercises, keyed by exercise index. */
  fills: Map<number, { reps?: number; weight?: number; seconds?: number }[]>
}

/**
 * Three ways in: scan Garmin screenshots (free on-device OCR), import a .fit/.zip export,
 * or type the numbers. Everything lands in a review sheet before it touches the workout.
 */
export function GarminImport({ value, exercises, onApply }: { value?: GarminData; exercises: LoggedExercise[]; onApply: (a: GarminApply) => void }) {
  const toast = useToast()
  const imgInput = useRef<HTMLInputElement>(null)
  const fitInput = useRef<HTMLInputElement>(null)
  const [scanP, setScanP] = useState<null | number>(null)
  const [fitBusy, setFitBusy] = useState(false)
  const busy = scanP != null || fitBusy
  const [review, setReview] = useState<{ data: GarminData; date?: Date; sets: (ScannedSet | FitSet & { exercise?: string })[]; text?: string } | null>(null)
  const [manual, setManual] = useState(false)

  async function onImages(files: FileList | null) {
    if (!files?.length) return
    setScanP(0)
    try {
      const text = await readText(Array.from(files), p => setScanP(p))
      const scan = parseGarminText(text)
      haptic.success()
      setReview(scan)
    } catch (e) {
      haptic.warn()
      toast(`Scan failed: ${(e as Error).message}`, 'err')
    } finally {
      setScanP(null)
      if (imgInput.current) imgInput.current.value = ''
    }
  }

  async function onFit(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setFitBusy(true)
    try {
      const { parseGarminFile } = await import('../lib/garmin')
      const { data, sets } = await parseGarminFile(f)
      haptic.success()
      setReview({ data, date: data.startTime ? new Date(data.startTime) : undefined, sets: sets.map(s => ({ ...s, exercise: s.category?.replace(/_/g, ' ') })) })
    } catch (e) {
      haptic.warn()
      toast((e as Error).message, 'err')
    } finally {
      setFitBusy(false)
      if (fitInput.current) fitInput.current.value = ''
    }
  }

  function matchSets(sets: { exercise?: string; reps?: number; weight?: number; durationSec?: number; seconds?: number }[]) {
    const fills = new Map<number, { reps?: number; weight?: number; seconds?: number }[]>()
    const opts = exercises.map((e, i) => ({ name: e.name, i }))
    for (const s of sets) {
      if (!s.exercise) continue
      const m = bestMatch(s.exercise, opts, 0.25)
      if (!m) continue
      const arr = fills.get(m.i) ?? []
      arr.push({ reps: s.reps, weight: s.weight, seconds: s.seconds ?? s.durationSec })
      fills.set(m.i, arr)
    }
    return fills
  }

  const matched = review ? matchSets(review.sets) : new Map()

  return (
    <Panel className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-cyan/10 text-cyan"><Watch size={20} /></span>
        <div className="flex-1">
          <div className="font-display text-lg">Garmin data</div>
          <div className="text-xs text-mute">
            {value ? `${value.source === 'fit' ? 'FIT import' : value.source === 'screenshot' ? 'Scanned screenshot' : 'Entered manually'} attached` : 'Scan screenshots, import a file, or type it in'}
          </div>
        </div>
      </div>

      {value && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Time" value={fmtDuration(value.durationSec ?? value.activeSec)} />
          <Metric label="Calories" value={value.calories ? `${value.calories}` : '—'} unit="kcal" />
          <Metric label="Avg HR" value={value.avgHr ? `${value.avgHr}` : '—'} unit="bpm" />
          <Metric label="Max HR" value={value.maxHr ? `${value.maxHr}` : '—'} unit="bpm" />
        </div>
      )}

      <div className="mt-4 grid gap-2">
        <Button variant="outline" onClick={() => imgInput.current?.click()} disabled={busy}
          icon={scanP != null ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}>
          {scanP != null ? `Reading ${Math.round(scanP * 100)}%` : 'Scan screenshots'}
        </Button>
        <Button variant="outline" onClick={() => fitInput.current?.click()} disabled={busy} icon={fitBusy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}>
          Import .FIT / .zip
        </Button>
        <Button variant="ghost" onClick={() => setManual(true)}>Type it in</Button>
      </div>
      <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={e => onImages(e.target.files)} />
      <input ref={fitInput} type="file" accept=".fit,.zip,application/zip,application/octet-stream" hidden onChange={e => onFit(e.target.files)} />

      {/* Review what was read before applying */}
      <Sheet open={!!review} onClose={() => setReview(null)} title="Check what was read" wide>
        {review && (
          <ReviewForm
            initial={review.data}
            date={review.date}
            matchedCount={[...matched.values()].reduce((a, b) => a + b.length, 0)}
            rawText={review.text}
            onCancel={() => setReview(null)}
            onSave={(data, date) => {
              onApply({ data, date, fills: matched })
              setReview(null)
              toast('Garmin data attached')
            }}
          />
        )}
      </Sheet>

      <Sheet open={manual} onClose={() => setManual(false)} title="Enter Garmin numbers">
        <ReviewForm
          initial={value ?? { source: 'manual' }}
          matchedCount={0}
          onCancel={() => setManual(false)}
          onSave={data => {
            onApply({ data: { ...data, source: value?.source ?? 'manual' }, fills: new Map() })
            setManual(false)
            toast('Saved')
          }}
        />
      </Sheet>
    </Panel>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-dim">{label}</div>
      <div className="font-display text-lg tabular">{value}{unit && value !== '—' && <span className="ml-1 font-mono text-[10px] text-mute">{unit}</span>}</div>
    </div>
  )
}

function ReviewForm({ initial, date, matchedCount, rawText, onSave, onCancel }: {
  initial: GarminData; date?: Date; matchedCount: number; rawText?: string
  onSave: (d: GarminData, date?: Date) => void; onCancel: () => void
}) {
  const [d, setD] = useState<GarminData>(initial)
  const [showRaw, setShowRaw] = useState(false)
  const n = (v: string) => (v === '' ? undefined : Number(v))
  const dur = d.durationSec ?? d.activeSec
  const set = (p: Partial<GarminData>) => setD(x => ({ ...x, ...p }))

  return (
    <div className="space-y-4">
      {date && <div className="rounded-xl bg-cyan/5 p-3 text-sm text-cyan">Workout date detected: {fmtLong(date)}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Duration (min)">
          <input className="field tabular" inputMode="decimal" type="number" value={dur != null ? Math.round(dur / 60) : ''}
            onChange={e => set({ durationSec: e.target.value === '' ? undefined : Number(e.target.value) * 60 })} />
        </Field>
        <Field label="Calories"><input className="field tabular" inputMode="numeric" type="number" value={d.calories ?? ''} onChange={e => set({ calories: n(e.target.value) })} /></Field>
        <Field label="Avg HR"><input className="field tabular" inputMode="numeric" type="number" value={d.avgHr ?? ''} onChange={e => set({ avgHr: n(e.target.value) })} /></Field>
        <Field label="Max HR"><input className="field tabular" inputMode="numeric" type="number" value={d.maxHr ?? ''} onChange={e => set({ maxHr: n(e.target.value) })} /></Field>
        <Field label="Total sets"><input className="field tabular" inputMode="numeric" type="number" value={d.totalSets ?? ''} onChange={e => set({ totalSets: n(e.target.value) })} /></Field>
        <Field label="Total reps"><input className="field tabular" inputMode="numeric" type="number" value={d.totalReps ?? ''} onChange={e => set({ totalReps: n(e.target.value) })} /></Field>
      </div>
      {matchedCount > 0 && (
        <div className="rounded-xl bg-lime/5 p-3 text-sm text-lime">{matchedCount} sets matched to your exercises. They'll fill any empty set rows.</div>
      )}
      {rawText != null && (
        <div>
          <button className="text-xs text-mute underline" onClick={() => setShowRaw(s => !s)}>{showRaw ? 'Hide' : 'Show'} raw scanned text</button>
          {showRaw && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 font-mono text-[11px] text-mute">{rawText || '(nothing read)'}</pre>}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(d, date)}>Use these numbers</Button>
      </div>
    </div>
  )
}
