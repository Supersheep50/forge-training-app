import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Columns2, ImagePlus, Trash2 } from 'lucide-react'
import { db, uid, type Photo } from '../db'
import { Button, Chip, cx, Empty, Field, PageHeader, Panel, Segmented, Sheet, useToast } from '../components/ui'
import { dayKey, fmtDate, relDay } from '../lib/format'
import { compressImage } from '../lib/files'
import { haptic } from '../lib/haptics'

const POSES = ['front', 'side', 'back', 'other'] as const

function useObjectUrl(blob?: Blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}

export default function Photos() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), []) ?? []
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<File[] | null>(null)
  const [pose, setPose] = useState<Photo['pose']>('front')
  const [date, setDate] = useState(dayKey())
  const [weight, setWeight] = useState('')
  const [filter, setFilter] = useState<Photo['pose'] | 'all'>('all')
  const [viewing, setViewing] = useState<Photo | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [selecting, setSelecting] = useState(false)

  async function saveUpload() {
    if (!pending) return
    for (const f of pending) {
      await db.photos.add({ id: uid(), date, pose, blob: await compressImage(f), weight: weight ? Number(weight) : undefined })
    }
    haptic.success()
    toast(`${pending.length} photo${pending.length > 1 ? 's' : ''} saved`)
    setPending(null)
    setWeight('')
  }

  const list = photos.filter(p => filter === 'all' || p.pose === filter)
  const groups = new Map<string, Photo[]>()
  list.forEach(p => groups.set(p.date, [...(groups.get(p.date) ?? []), p]))

  const toggleSelect = (id: string) => {
    haptic.select()
    setCompare(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id].slice(-2)))
  }

  const pair = compare.map(id => photos.find(p => p.id === id)!).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <>
      <PageHeader
        kicker={`${photos.length} photos · ${groups.size} check-ins`}
        title="Progress"
        right={
          <>
            {photos.length > 1 && (
              <Button variant={selecting ? 'primary' : 'outline'} icon={<Columns2 size={16} />} onClick={() => { setSelecting(s => !s); setCompare([]) }}>
                {selecting ? 'Cancel' : 'Compare'}
              </Button>
            )}
            <Button icon={<ImagePlus size={16} />} onClick={() => input.current?.click()}>Add</Button>
          </>
        }
      />
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files?.length) { setPending(Array.from(e.target.files)); setDate(dayKey()) } e.target.value = '' }} />

      {selecting && (
        <Panel className="mb-4 flex animate-rise items-center gap-3 border-cyan/40 p-4">
          <Columns2 className="text-cyan" size={18} />
          <div className="flex-1 text-sm">Pick two photos to compare <span className="text-mute">({compare.length}/2)</span></div>
          <Button disabled={compare.length !== 2} onClick={() => setComparing(true)}>View</Button>
        </Panel>
      )}

      <div className="mb-5 flex gap-2 overflow-x-auto no-scrollbar">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
        {POSES.map(p => <Chip key={p} active={filter === p} onClick={() => setFilter(p)}>{p}</Chip>)}
      </div>

      {photos.length === 0 ? (
        <Empty icon={<Camera />} title="No progress photos yet" body="Same spot, same light, every couple of weeks. You'll thank yourself later." action={<Button onClick={() => input.current?.click()}>Add first photo</Button>} />
      ) : (
        [...groups].map(([d, ps]) => (
          <div key={d} className="mb-6">
            <div className="mb-2 flex items-baseline gap-3">
              <span className="font-display text-lg">{fmtDate(d + 'T12:00', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-dim">{relDay(d + 'T12:00')}</span>
              {ps.find(p => p.weight) && <span className="font-mono text-xs text-mute">{ps.find(p => p.weight)!.weight}kg</span>}
            </div>
            <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ps.map(p => (
                <Thumb key={p.id} photo={p} selected={compare.includes(p.id)} selectable={selecting}
                  onClick={() => (selecting ? toggleSelect(p.id) : setViewing(p))} />
              ))}
            </div>
          </div>
        ))
      )}

      <Sheet open={!!pending} onClose={() => setPending(null)} title={`Add ${pending?.length ?? 0} photo${(pending?.length ?? 0) > 1 ? 's' : ''}`}>
        <div className="space-y-4">
          <Segmented value={pose} options={POSES.map(p => ({ value: p, label: p }))} onChange={setPose} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className="field" value={date} max={dayKey()} onChange={e => setDate(e.target.value)} /></Field>
            <Field label="Bodyweight (opt)"><input type="number" inputMode="decimal" className="field" placeholder="kg" value={weight} onChange={e => setWeight(e.target.value)} /></Field>
          </div>
          <Button className="w-full" onClick={saveUpload}>Save</Button>
        </div>
      </Sheet>

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${fmtDate(viewing.date + 'T12:00', { day: 'numeric', month: 'long', year: 'numeric' })} · ${viewing.pose}` : ''} wide>
        {viewing && <Viewer photo={viewing} onDelete={async () => {
          if (!confirm('Delete this photo?')) return
          await db.photos.delete(viewing.id)
          haptic.warn()
          setViewing(null)
        }} />}
      </Sheet>

      <Sheet open={comparing} onClose={() => setComparing(false)} title="Before / After" wide>
        {pair.length === 2 && <CompareSlider before={pair[0]} after={pair[1]} />}
      </Sheet>
    </>
  )
}

function Thumb({ photo, onClick, selected, selectable }: { photo: Photo; onClick: () => void; selected: boolean; selectable: boolean }) {
  const url = useObjectUrl(photo.blob)
  return (
    <button onClick={onClick} className={cx('pressable group relative aspect-[3/4] overflow-hidden rounded-2xl border transition-all', selected ? 'border-cyan shadow-[0_0_24px_-6px_#00f0ff]' : 'border-line')}>
      <img src={url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-left font-mono text-[10px] uppercase tracking-widest text-ink/80">{photo.pose}</div>
      {selectable && (
        <span className={cx('absolute right-2 top-2 grid size-6 place-items-center rounded-full border-2 font-mono text-[10px]', selected ? 'border-cyan bg-cyan text-bg' : 'border-white/60 bg-black/40')}>
          {selected ? '✓' : ''}
        </span>
      )}
    </button>
  )
}

function Viewer({ photo, onDelete }: { photo: Photo; onDelete: () => void }) {
  const url = useObjectUrl(photo.blob)
  return (
    <div>
      <img src={url} alt="" className="mx-auto max-h-[70dvh] rounded-2xl" />
      <div className="mt-4 flex justify-end">
        <Button variant="danger" icon={<Trash2 size={14} />} onClick={onDelete}>Delete</Button>
      </div>
    </div>
  )
}

/** Drag the divider to wipe between two photos. */
function CompareSlider({ before, after }: { before: Photo; after: Photo }) {
  const a = useObjectUrl(before.blob)
  const b = useObjectUrl(after.blob)
  const [pos, setPos] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect()
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }
  const days = Math.round((new Date(after.date).getTime() - new Date(before.date).getTime()) / 86400000)

  return (
    <div>
      <div
        ref={box}
        className="relative mx-auto aspect-[3/4] max-h-[70dvh] touch-none select-none overflow-hidden rounded-2xl border border-line"
        onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX) }}
        onPointerMove={e => e.buttons && move(e.clientX)}
      >
        <img src={b} alt="" className="absolute inset-0 size-full object-cover" />
        <img src={a} alt="" className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <div className="absolute inset-y-0 w-0.5 bg-cyan shadow-[0_0_12px_#00f0ff]" style={{ left: `${pos}%` }}>
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan px-2 py-1 font-mono text-[10px] text-bg">⇆</div>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 font-mono text-[10px]">{fmtDate(before.date + 'T12:00')}</span>
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 font-mono text-[10px]">{fmtDate(after.date + 'T12:00')}</span>
      </div>
      <div className="mt-3 text-center font-mono text-xs text-mute">
        {days} days apart
        {before.weight && after.weight && ` · ${(after.weight - before.weight) >= 0 ? '+' : ''}${(after.weight - before.weight).toFixed(1)}kg`}
      </div>
    </div>
  )
}
