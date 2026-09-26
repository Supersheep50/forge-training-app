import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { fmtClock } from '../lib/format'
import { haptic } from '../lib/haptics'
import { cx } from './ui'

/** Floating countdown that appears after a set is ticked off. */
export function RestTimer({ endsAt, total, onChange, onClose }: { endsAt: number; total: number; onChange: (endsAt: number, total: number) => void; onClose: () => void }) {
  const [now, setNow] = useState(Date.now())
  const fired = useRef(false)
  const left = Math.max(0, (endsAt - now) / 1000)

  useEffect(() => {
    fired.current = false
    const i = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(i)
  }, [endsAt])

  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true
      haptic.timerDone()
      const t = setTimeout(onClose, 2500)
      return () => clearTimeout(t)
    }
  }, [left, onClose])

  const pct = total ? left / total : 0
  const done = left <= 0
  const adjust = (d: number) => { haptic.tap(); onChange(endsAt + d * 1000, Math.max(1, total + d)) }

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6 md:left-20 xl:left-60">
      <div className={cx('panel flex animate-rise items-center gap-3 py-2 pl-2 pr-3 backdrop-blur-xl', done && 'border-lime/60 shadow-[0_0_40px_-6px_rgb(182_255_59/0.7)]')} style={{ background: 'rgb(12 15 22 / 0.92)' }}>
        <div className="relative grid size-14 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="16" fill="none" stroke={done ? '#b6ff3b' : '#00f0ff'} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={100.5} strokeDashoffset={100.5 * (1 - pct)} className="transition-[stroke-dashoffset] duration-300"
              style={{ filter: `drop-shadow(0 0 4px ${done ? '#b6ff3b' : '#00f0ff'})` }}
            />
          </svg>
          <span className="font-mono text-[11px] tabular">{done ? 'GO' : fmtClock(left)}</span>
        </div>
        <div className="mr-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">{done ? 'Rest over' : 'Resting'}</div>
          <div className="font-display text-sm">{done ? 'Next set 💪' : 'Breathe. Reset.'}</div>
        </div>
        <button onClick={() => adjust(-15)} className="pressable grid size-9 place-items-center rounded-lg bg-white/5 text-mute" aria-label="Minus 15 seconds"><Minus size={16} /></button>
        <button onClick={() => adjust(15)} className="pressable grid size-9 place-items-center rounded-lg bg-white/5 text-mute" aria-label="Plus 15 seconds"><Plus size={16} /></button>
        <button onClick={() => { haptic.tap(); onClose() }} className="pressable grid size-9 place-items-center rounded-lg bg-white/5 text-mute" aria-label="Dismiss"><X size={16} /></button>
      </div>
    </div>
  )
}
