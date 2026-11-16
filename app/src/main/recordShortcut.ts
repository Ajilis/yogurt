import { RECORD_ACCELERATOR } from '../shared/platform'

/** a held key repeats on Windows: presses this close together count once, so a long press never starts and then finishes */
export const RECORD_PRESS_GAP_MS = 1000

type Shortcuts = { register(accelerator: string, onPress: () => void): boolean; unregister(accelerator: string): void }

/**
 * Registers the shortcut with the system. A press starts a note when nothing records (the menu bar's Start recording)
 * and finishes the one that records, paused or not (its Finish recording). Another app holding the same keys keeps
 * them: Yogurt says so in its log and goes on without. Gives back the stop, for quitting.
 */
export function hookRecordShortcut(d: {
  shortcuts: Shortcuts
  active(): { id: string } | null | undefined
  start(): void
  stop(id: string): void
  now?: () => number
}): { registered: boolean; dispose(): void } {
  const now = d.now ?? Date.now
  let last = -Infinity
  const press = () => {
    const at = now()
    if (at - last < RECORD_PRESS_GAP_MS) return
    last = at
    try {
      const m = d.active()
      if (m) d.stop(m.id)
      else d.start()
    } catch (e) { console.error('record shortcut failed', e) }
  }
  let registered = false
  try { registered = d.shortcuts.register(RECORD_ACCELERATOR, press) } catch (e) { console.warn('record shortcut could not be registered', e) }
  if (!registered) console.warn(`record shortcut ${RECORD_ACCELERATOR} is taken by another app: start recording from the menu bar instead`)
  return {
    registered,
    dispose: () => { if (registered) { registered = false; d.shortcuts.unregister(RECORD_ACCELERATOR) } },
  }
}
