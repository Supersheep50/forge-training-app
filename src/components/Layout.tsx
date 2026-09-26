import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import {
  Activity, BarChart3, Camera, ClipboardList, Grid2x2, Home, ListChecks, Plus, Settings,
} from 'lucide-react'
import { haptic } from '../lib/haptics'
import { cx, Sheet } from './ui'

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/workouts', label: 'Workouts', icon: Activity },
  { to: '/log', label: 'Log', icon: Plus },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/checkin', label: 'Daily', icon: ListChecks },
  { to: '/photos', label: 'Photos', icon: Camera },
  { to: '/programme', label: 'Programme', icon: ClipboardList },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation()
  const nav = useNavigate()
  const [more, setMore] = useState(false)

  return (
    <div className="relative flex min-h-dvh">
      <div className="backdrop" />

      {/* Rail — unfolded / tablet */}
      <aside className="sticky top-0 z-20 hidden h-dvh w-20 shrink-0 flex-col border-r border-line bg-bg/60 px-3 py-6 xl:w-60 xl:px-4 backdrop-blur-xl md:flex">
        <div className="mb-8 flex items-center justify-center gap-3 xl:justify-start xl:px-2">
          <img src="./icon.svg" alt="" className="size-9 rounded-lg" />
          <div className="hidden xl:block">
            <div className="font-display text-xl font-bold tracking-[0.3em]">FORGE</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-mute">Training System</div>
          </div>
        </div>

        <button
          onClick={() => { haptic.select(); nav('/log') }}
          className="pressable mb-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan font-display text-sm font-semibold uppercase tracking-wider text-bg shadow-[0_0_30px_-6px_rgb(0_240_255/0.8)]"
        >
          <Plus size={18} strokeWidth={2.5} /> <span className="hidden xl:inline">Log Workout</span>
        </button>

        <nav className="flex flex-col gap-1">
          {NAV.filter(n => n.to !== '/log').map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              title={n.label}
              end={n.to === '/'}
              onClick={() => haptic.select()}
              className={({ isActive }) => cx(
                'group relative flex h-11 items-center justify-center gap-3 rounded-xl px-3 font-display xl:justify-start text-sm uppercase tracking-wider transition-colors',
                isActive ? 'bg-white/[0.06] text-ink' : 'text-mute hover:bg-white/[0.03] hover:text-ink',
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cx('absolute left-0 h-5 w-[3px] rounded-r bg-cyan shadow-[0_0_10px_#00f0ff] transition-all', isActive ? 'opacity-100' : 'opacity-0')} />
                  <n.icon size={18} className={isActive ? 'text-cyan' : ''} />
                  <span className="hidden xl:inline">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden px-2 font-mono text-[10px] tracking-widest text-dim xl:block">v1.0 · OFFLINE READY</div>
      </aside>

      <main className="relative z-10 min-w-0 flex-1">
        <div key={loc.pathname.split('/')[1]} className="page-enter mx-auto max-w-6xl px-4 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] md:px-8 md:pb-12 md:pt-8">
          {children}
        </div>
      </main>

      {/* Bottom bar — folded / phone */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
          {[NAV[0], NAV[1]].map(n => <BottomItem key={n.to} {...n} />)}
          <button
            aria-label="Log workout"
            onClick={() => { haptic.select(); nav('/log') }}
            className="pressable -mt-8 grid size-14 place-items-center rounded-2xl bg-cyan text-bg shadow-[0_0_30px_-4px_rgb(0_240_255/0.9)]"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
          {[NAV[3], NAV[4]].map(n => <BottomItem key={n.to} {...n} />)}
          <button
            onClick={() => { haptic.select(); setMore(true) }}
            className={cx('flex w-14 flex-col items-center gap-1 text-[10px] uppercase tracking-wider', ['/photos', '/programme', '/settings'].includes(loc.pathname) ? 'text-cyan' : 'text-mute')}
          >
            <Grid2x2 size={20} />
            More
          </button>
        </div>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="grid grid-cols-3 gap-3">
          {NAV.slice(5).map(n => (
            <button
              key={n.to}
              onClick={() => { haptic.select(); setMore(false); nav(n.to) }}
              className="pressable panel flex flex-col items-center gap-2 py-5 font-display text-xs uppercase tracking-wider text-mute hover:text-ink"
            >
              <n.icon size={22} className="text-cyan" />
              {n.label}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

function BottomItem({ to, label, icon: Icon }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={() => haptic.select()}
      className={({ isActive }) => cx('flex w-14 flex-col items-center gap-1 text-[10px] uppercase tracking-wider transition-colors', isActive ? 'text-cyan' : 'text-mute')}
    >
      {({ isActive }) => (
        <>
          <Icon size={20} className={isActive ? 'drop-shadow-[0_0_8px_#00f0ff]' : ''} />
          {label}
        </>
      )}
    </NavLink>
  )
}
