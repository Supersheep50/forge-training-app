import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import type { WorkoutType } from '../db'
import { haptic } from '../lib/haptics'

// ---------- colour helpers ----------

export const TYPE_COLORS = {
  cyan: { hex: '#00f0ff', text: 'text-cyan', bg: 'bg-cyan', glow: 'glow-cyan', soft: 'rgb(0 240 255 / 0.12)' },
  pink: { hex: '#ff2bd6', text: 'text-pink', bg: 'bg-pink', glow: 'glow-pink', soft: 'rgb(255 43 214 / 0.12)' },
  lime: { hex: '#b6ff3b', text: 'text-lime', bg: 'bg-lime', glow: 'glow-lime', soft: 'rgb(182 255 59 / 0.12)' },
} as const

export const tc = (t?: Pick<WorkoutType, 'color'>) => TYPE_COLORS[t?.color ?? 'cyan']

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

// ---------- layout primitives ----------

export function Panel({ className, children, onClick, style }: { className?: string; children: ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <div
      className={cx('panel relative', onClick && 'pressable cursor-pointer hover:border-line-2', className)}
      onClick={onClick ? () => { haptic.tap(); onClick() } : undefined}
      style={style}
    >
      {children}
    </div>
  )
}

export function PageHeader({ kicker, title, right }: { kicker?: string; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan/80">{kicker}</div>}
        <h1 className="font-display text-3xl font-semibold leading-none tracking-wide md:text-4xl">{title}</h1>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{children}</h2>
      {right}
    </div>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger'

export function Button({
  children, onClick, variant = 'primary', className, disabled, type = 'button', icon,
}: {
  children?: ReactNode; onClick?: () => void; variant?: BtnVariant; className?: string
  disabled?: boolean; type?: 'button' | 'submit'; icon?: ReactNode
}) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-cyan text-bg font-semibold shadow-[0_0_24px_-4px_rgb(0_240_255/0.6)] hover:brightness-110',
    ghost: 'bg-white/5 text-ink hover:bg-white/10',
    outline: 'border border-line-2 text-ink hover:border-cyan/50 hover:text-cyan',
    danger: 'bg-red/10 text-red border border-red/30 hover:bg-red/20',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => { haptic.tap(); onClick?.() }}
      className={cx(
        'pressable inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-display text-sm uppercase tracking-wider',
        'disabled:pointer-events-none disabled:opacity-40',
        styles[variant], className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({ children, onClick, label, className }: { children: ReactNode; onClick?: () => void; label: string; className?: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={() => { haptic.tap(); onClick?.() }}
      className={cx('pressable grid size-10 place-items-center rounded-xl bg-white/5 text-mute hover:bg-white/10 hover:text-ink', className)}
    >
      {children}
    </button>
  )
}

export function Chip({ active, onClick, children, color = '#00f0ff' }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      onClick={() => { haptic.select(); onClick?.() }}
      className={cx(
        'pressable h-9 shrink-0 rounded-full border px-4 font-display text-xs uppercase tracking-wider',
        active ? 'text-bg' : 'border-line text-mute hover:text-ink',
      )}
      style={active ? { background: color, borderColor: color, boxShadow: `0 0 18px -4px ${color}` } : undefined}
    >
      {children}
    </button>
  )
}

export function TypeBadge({ type, size = 'md' }: { type?: WorkoutType; size?: 'sm' | 'md' | 'lg' }) {
  const c = tc(type)
  const dims = size === 'lg' ? 'size-14 text-lg' : size === 'sm' ? 'size-8 text-[11px]' : 'size-11 text-sm'
  return (
    <div
      className={cx('clip-corner grid shrink-0 place-items-center font-display font-bold', dims)}
      style={{ background: c.soft, color: c.hex, boxShadow: `inset 0 0 0 1px ${c.hex}55` }}
    >
      {type?.code ?? '??'}
    </div>
  )
}

// ---------- animated numbers ----------

export function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setV(a + (target - a) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

export function CountUp({ value, digits = 0, className }: { value: number; digits?: number; className?: string }) {
  const v = useCountUp(value)
  return <span className={cx('tabular', className)}>{v.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })}</span>
}

export function Stat({
  label, value, unit, digits = 0, accent = 'text-ink', sub, icon,
}: { label: string; value?: number; unit?: string; digits?: number; accent?: string; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <Panel className="overflow-hidden p-4">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
        {label}
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <div className={cx('mt-2 font-display text-3xl font-semibold', accent)}>
        {value == null ? <span className="text-dim">—</span> : <CountUp value={value} digits={digits} />}
        {unit && value != null && <span className="ml-1 font-mono text-xs font-normal text-mute">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-mute">{sub}</div>}
    </Panel>
  )
}

// ---------- toggles ----------

export function Toggle({ on, onChange, color = '#00f0ff' }: { on: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => { haptic.toggle(); onChange(!on) }}
      className="relative h-7 w-12 shrink-0 rounded-full border border-line transition-colors"
      style={{ background: on ? color : 'rgb(255 255 255 / 0.06)', boxShadow: on ? `0 0 16px -2px ${color}` : undefined }}
    >
      <span className={cx('absolute top-0.5 size-5.5 rounded-full bg-white transition-all duration-300', on ? 'left-[22px] bg-bg!' : 'left-0.5')} />
    </button>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl border border-line bg-panel-2 p-1">
      {options.map(o => (
        <button
          key={String(o.value)}
          onClick={() => { haptic.select(); onChange(o.value) }}
          className={cx(
            'pressable h-9 flex-1 rounded-lg px-3 font-display text-xs uppercase tracking-wider',
            value === o.value ? 'bg-white/10 text-ink shadow-[inset_0_0_0_1px_rgb(0_240_255/0.35)]' : 'text-mute',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-dim">{hint}</span>}
    </label>
  )
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <Panel className="grid place-items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-white/5 text-cyan">{icon}</div>
      <div className="font-display text-lg">{title}</div>
      {body && <p className="max-w-sm text-sm text-mute">{body}</p>}
      {action}
    </Panel>
  )
}

// ---------- sheet (modal) with fade in/out ----------

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 280)
      return () => clearTimeout(t)
    }
  }, [open])
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className={cx('absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        className={cx(
          'panel relative max-h-[90dvh] w-full overflow-y-auto rounded-b-none p-5 transition-all duration-300 ease-out md:rounded-b-[18px]',
          wide ? 'md:max-w-3xl' : 'md:max-w-lg',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        )}
        style={{ background: 'var(--color-panel)' }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="font-display text-lg tracking-wide">{title}</div>
          <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ---------- toasts ----------

interface ToastMsg { id: number; text: ReactNode; tone: 'ok' | 'pr' | 'err' }
const ToastCtx = createContext<(text: ReactNode, tone?: ToastMsg['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<(ToastMsg & { leaving?: boolean })[]>([])
  const push = useCallback((text: ReactNode, tone: ToastMsg['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems(x => [...x, { id, text, tone }])
    setTimeout(() => setItems(x => x.map(t => (t.id === id ? { ...t, leaving: true } : t))), tone === 'pr' ? 3800 : 2400)
    setTimeout(() => setItems(x => x.filter(t => t.id !== id)), tone === 'pr' ? 4200 : 2800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
          {items.map(t => (
            <div
              key={t.id}
              className={cx(
                'panel flex items-center gap-3 px-4 py-3 text-sm transition-all duration-400',
                t.leaving ? '-translate-y-3 opacity-0' : 'animate-rise',
                t.tone === 'pr' && 'border-pink/50 shadow-[0_0_40px_-8px_rgb(255_43_214/0.7)]',
                t.tone === 'err' && 'border-red/40',
              )}
            >
              <span className={cx('grid size-6 place-items-center rounded-full', t.tone === 'pr' ? 'bg-pink text-bg' : t.tone === 'err' ? 'bg-red text-bg' : 'bg-cyan text-bg')}>
                {t.tone === 'err' ? <X size={14} /> : <Check size={14} />}
              </span>
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
