import { useEffect, useState } from 'react'
import { haptic } from '../lib/haptics'
import { cx } from './ui'

const WORD = 'FORGE'
const GLYPHS = '#%&$@01<>/\\=+*'

/** Boot sequence shown on launch: logo assembles, letters decode, bar fills, then fades away. */
export function Intro({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('     ')
  const [progress, setProgress] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = now - start
      // Decode effect: each letter settles 120ms after the previous one
      setText(
        WORD.split('')
          .map((ch, i) => (t > 450 + i * 120 ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(''),
      )
      setProgress(Math.min(1, t / 1500))
      if (t < 1550) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const b1 = setTimeout(() => haptic.tap(), 450)
    const b2 = setTimeout(() => haptic.success(), 1100)
    const leave = setTimeout(() => setLeaving(true), 1750)
    const done = setTimeout(onDone, 2300)
    return () => { cancelAnimationFrame(raf); [b1, b2, leave, done].forEach(clearTimeout) }
  }, [onDone])

  const skip = () => { setLeaving(true); setTimeout(onDone, 350) }

  return (
    <div
      onClick={skip}
      className={cx(
        'fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-bg transition-opacity duration-500',
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <div className="backdrop" />
      {/* scanline sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-scan h-1/3 w-full bg-gradient-to-b from-transparent via-cyan/10 to-transparent" />
      </div>

      <div className={cx('relative flex flex-col items-center transition-transform duration-500', leaving && 'scale-110')}>
        <svg viewBox="0 0 512 512" className="size-28 animate-pop drop-shadow-[0_0_30px_rgb(0_240_255/0.5)]">
          <defs>
            <linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#00f0ff" />
              <stop offset="1" stopColor="#ff2bd6" />
            </linearGradient>
          </defs>
          <g fill="url(#ig)">
            <rect x="96" y="226" width="320" height="60" rx="10" className="origin-center animate-[pop_.5s_.15s_both]" />
            <rect x="120" y="156" width="52" height="200" rx="12" className="animate-[rise_.5s_.25s_both]" />
            <rect x="340" y="156" width="52" height="200" rx="12" className="animate-[rise_.5s_.3s_both]" />
            <rect x="72" y="188" width="36" height="136" rx="10" className="animate-[rise_.5s_.35s_both]" />
            <rect x="404" y="188" width="36" height="136" rx="10" className="animate-[rise_.5s_.4s_both]" />
          </g>
        </svg>

        <div className="mt-6 font-display text-5xl font-bold tracking-[0.35em] text-ink glow-cyan">{text}</div>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.4em] text-mute animate-[fade_.6s_.6s_both]">
          Training System
        </div>

        <div className="mt-8 h-[3px] w-56 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan to-pink shadow-[0_0_12px_rgb(0_240_255/0.8)]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-3 font-mono text-[10px] tracking-[0.3em] text-dim tabular">
          {progress < 1 ? `INITIALISING ${Math.round(progress * 100)}%` : 'READY'}
        </div>
      </div>
    </div>
  )
}
