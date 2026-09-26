// Thin wrapper around the Vibration API (works in Chrome on Android).
let enabled = localStorageGet('forge.haptics') !== 'off'

function localStorageGet(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}

export function setHapticsEnabled(on: boolean) {
  enabled = on
  try { localStorage.setItem('forge.haptics', on ? 'on' : 'off') } catch { /* ignore */ }
}
export const hapticsEnabled = () => enabled

function buzz(pattern: number | number[]) {
  if (!enabled) return
  try { navigator.vibrate?.(pattern) } catch { /* ignore */ }
}

export const haptic = {
  tap: () => buzz(8),
  select: () => buzz(14),
  toggle: () => buzz([10, 30, 10]),
  success: () => buzz([18, 60, 28]),
  warn: () => buzz([40, 50, 40]),
  pr: () => buzz([20, 40, 20, 40, 60, 80, 120]),
  timerDone: () => buzz([200, 100, 200, 100, 400]),
}
