import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { GripVertical, Loader2, Pencil, Plus, ScanLine, Trash2, Zap } from 'lucide-react'
import { db, uid, type TemplateExercise, type WorkoutType } from '../db'
import { Button, cx, Field, IconButton, PageHeader, Panel, Segmented, Sheet, tc, TypeBadge, useToast } from '../components/ui'
import { haptic } from '../lib/haptics'
import { useTypes } from '../lib/hooks'
import { parseProgrammeText, readText } from '../lib/ocr'

export default function Programme() {
  const types = useTypes()
  const nav = useNavigate()
  const [editing, setEditing] = useState<{ typeId: string; ex: TemplateExercise } | null>(null)
  const [scanFor, setScanFor] = useState<WorkoutType | null>(null)

  const saveTypes = (t: WorkoutType) => db.types.put(t)

  return (
    <>
      <PageHeader kicker="Level 2 · 3-day rotation" title="Programme" />

      <div className="grid gap-4 xl:grid-cols-3">
        {types.map(t => {
          const c = tc(t)
          return (
            <Panel key={t.id} className="flex flex-col p-5" style={{ boxShadow: `inset 0 3px 0 -1px ${c.hex}` }}>
              <div className="flex items-center gap-3">
                <TypeBadge type={t} />
                <input
                  className={cx('min-w-0 flex-1 bg-transparent font-display text-xl outline-none', c.text)}
                  value={t.name}
                  onChange={e => saveTypes({ ...t, name: e.target.value })}
                />
              </div>

              <div className="stagger mt-4 flex-1 space-y-1">
                {t.exercises.map((e, i) => (
                  <div key={e.id} className="group flex items-center gap-2 rounded-xl p-2 hover:bg-white/[0.03]">
                    <div className="flex flex-col">
                      <button disabled={i === 0} className="text-dim hover:text-ink disabled:opacity-20" aria-label="Move up"
                        onClick={() => { haptic.tap(); const ex = [...t.exercises]; [ex[i - 1], ex[i]] = [ex[i], ex[i - 1]]; saveTypes({ ...t, exercises: ex }) }}>
                        <GripVertical size={14} />
                      </button>
                    </div>
                    <span className="w-5 font-mono text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{e.name}</div>
                      <div className="font-mono text-[10px] text-mute">
                        {e.sets} × {e.target}{e.perSide ? ' each' : ''}{e.notes ? ` · ${e.notes}` : ''}
                      </div>
                    </div>
                    <IconButton label="Edit" className="size-8 opacity-60 group-hover:opacity-100" onClick={() => setEditing({ typeId: t.id, ex: e })}><Pencil size={14} /></IconButton>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button variant="ghost" className="h-10 text-xs" icon={<Plus size={14} />}
                  onClick={() => setEditing({ typeId: t.id, ex: { id: uid(), name: '', sets: 3, target: '8-10', kind: 'weight' } })}>Add</Button>
                <Button variant="ghost" className="h-10 text-xs" icon={<ScanLine size={14} />} onClick={() => setScanFor(t)}>Scan</Button>
                <Button className="h-10 text-xs" icon={<Zap size={14} />} onClick={() => nav(`/log?type=${t.id}`)}>Start</Button>
              </div>
            </Panel>
          )
        })}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.ex.name ? 'Edit exercise' : 'New exercise'}>
        {editing && (
          <ExerciseForm
            initial={editing.ex}
            onCancel={() => setEditing(null)}
            onDelete={async () => {
              const t = types.find(x => x.id === editing.typeId)!
              await saveTypes({ ...t, exercises: t.exercises.filter(e => e.id !== editing.ex.id) })
              haptic.warn()
              setEditing(null)
            }}
            onSave={async ex => {
              const t = types.find(x => x.id === editing.typeId)!
              const exists = t.exercises.some(e => e.id === ex.id)
              await saveTypes({ ...t, exercises: exists ? t.exercises.map(e => (e.id === ex.id ? ex : e)) : [...t.exercises, ex] })
              haptic.success()
              setEditing(null)
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!scanFor} onClose={() => setScanFor(null)} title={`Scan programme · ${scanFor?.code}`} wide>
        {scanFor && <ScanProgramme type={scanFor} onDone={() => setScanFor(null)} />}
      </Sheet>
    </>
  )
}

function ExerciseForm({ initial, onSave, onCancel, onDelete }: { initial: TemplateExercise; onSave: (e: TemplateExercise) => void; onCancel: () => void; onDelete: () => void }) {
  const [e, setE] = useState(initial)
  const set = (p: Partial<TemplateExercise>) => setE(x => ({ ...x, ...p }))
  return (
    <form className="space-y-4" onSubmit={ev => { ev.preventDefault(); if (e.name.trim()) onSave({ ...e, name: e.name.trim() }) }}>
      <Field label="Name"><input autoFocus className="field" value={e.name} onChange={x => set({ name: x.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sets"><input className="field" type="number" inputMode="numeric" value={e.sets} onChange={x => set({ sets: Math.max(1, Number(x.target.value)) })} /></Field>
        <Field label="Target" hint="e.g. 8, 10-12, 30sec"><input className="field" value={e.target} onChange={x => set({ target: x.target.value })} /></Field>
      </div>
      <Field label="Measured by">
        <Segmented value={e.kind} options={[{ value: 'weight', label: 'Weight' }, { value: 'reps', label: 'Reps' }, { value: 'time', label: 'Time' }]} onChange={kind => set({ kind })} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="size-4 accent-cyan" checked={!!e.perSide} onChange={x => set({ perSide: x.target.checked || undefined })} />
        Each side / each leg
      </label>
      <Field label="Notes"><input className="field" value={e.notes ?? ''} onChange={x => set({ notes: x.target.value || undefined })} /></Field>
      <div className="flex gap-2 pt-2">
        {initial.name && <Button variant="danger" icon={<Trash2 size={14} />} onClick={onDelete}>Delete</Button>}
        <Button variant="ghost" className="ml-auto" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  )
}

function ScanProgramme({ type, onDone }: { type: WorkoutType; onDone: () => void }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [found, setFound] = useState<TemplateExercise[] | null>(null)

  async function run(files: FileList | null) {
    if (!files?.length) return
    setProgress(0)
    try {
      const text = await readText(Array.from(files), setProgress)
      const ex = parseProgrammeText(text)
      haptic[ex.length ? 'success' : 'warn']()
      setFound(ex)
    } catch (e) {
      toast(`Scan failed: ${(e as Error).message}`, 'err')
    } finally {
      setProgress(null)
    }
  }

  async function apply(mode: 'replace' | 'append') {
    if (!found) return
    await db.types.put({ ...type, exercises: mode === 'replace' ? found : [...type.exercises, ...found] })
    haptic.success()
    toast(`${found.length} exercises ${mode === 'replace' ? 'loaded' : 'added'}`)
    onDone()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">Screenshot your programme app (the list with "3 sets x 8") and pick the images. Reading happens on your phone, free and offline after the first use.</p>
      <Button variant="outline" className="w-full" disabled={progress != null} onClick={() => input.current?.click()}
        icon={progress != null ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}>
        {progress != null ? `Reading… ${Math.round(progress * 100)}%` : 'Choose screenshots'}
      </Button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => run(e.target.files)} />
      {found && (
        found.length === 0 ? <div className="rounded-xl bg-amber/10 p-3 text-sm text-amber">Couldn't find any "N sets x M" lines. Try a clearer screenshot.</div> : (
          <>
            <Panel className="divide-y divide-line">
              {found.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 p-3 animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <input className="field h-9 flex-1 py-1 text-sm" value={e.name} onChange={x => setFound(f => f!.map(y => (y.id === e.id ? { ...y, name: x.target.value } : y)))} />
                  <span className="shrink-0 font-mono text-xs text-mute">{e.sets} × {e.target}</span>
                  <button className="text-dim hover:text-red" onClick={() => setFound(f => f!.filter(y => y.id !== e.id))} aria-label="Remove"><Trash2 size={14} /></button>
                </div>
              ))}
            </Panel>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => apply('append')}>Add to {type.code}</Button>
              <Button className="flex-1" onClick={() => apply('replace')}>Replace {type.code}</Button>
            </div>
          </>
        )
      )}
    </div>
  )
}
