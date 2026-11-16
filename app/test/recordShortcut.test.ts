import { beforeEach, expect, it, vi } from 'vitest'
import { hookRecordShortcut, RECORD_PRESS_GAP_MS } from '../src/main/recordShortcut'
import { RECORD_ACCELERATOR, RECORD_KEYS, shortcutLabel } from '../src/shared/platform'

/** the system's shortcuts, as Electron's globalShortcut: the press is kept so a test can make one */
function system(free = true) {
  const s = { pressed: undefined as (() => void) | undefined, unregistered: [] as string[] }
  return {
    s,
    shortcuts: {
      register: vi.fn((_accelerator: string, onPress: () => void) => { if (free) s.pressed = onPress; return free }),
      unregister: vi.fn((accelerator: string) => { s.unregistered.push(accelerator) }),
    },
  }
}

let clock = 0
let recording: { id: string } | null = null
const start = vi.fn(() => { recording = { id: 'm1' } })
const stop = vi.fn(() => { recording = null })
beforeEach(() => { clock = 10_000; recording = null; start.mockClear(); stop.mockClear(); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
const hook = (shortcuts: ReturnType<typeof system>['shortcuts']) => hookRecordShortcut({ shortcuts, active: () => recording, start, stop, now: () => clock })

it('takes the same keys on every computer, three modifiers so no call app or browser loses one', () => {
  expect(RECORD_ACCELERATOR).toBe('CommandOrControl+Alt+Shift+R')
  expect([shortcutLabel(RECORD_KEYS, 'darwin'), shortcutLabel(RECORD_KEYS, 'win32'), shortcutLabel(RECORD_KEYS, 'linux')])
    .toEqual(['⌥⇧⌘R', 'Ctrl+Shift+Alt+R', 'Ctrl+Shift+Alt+R'])
})

it('starts a note when nothing records, and finishes the one that does', () => {
  const { s, shortcuts } = system()
  expect(hook(shortcuts).registered).toBe(true)
  expect(shortcuts.register).toHaveBeenCalledWith(RECORD_ACCELERATOR, expect.any(Function))
  s.pressed!()
  expect(start).toHaveBeenCalledTimes(1)
  clock += RECORD_PRESS_GAP_MS
  s.pressed!()
  expect(stop).toHaveBeenCalledWith('m1')
  expect(start).toHaveBeenCalledTimes(1)
})

it('counts a held key once, so a long press never starts and then finishes', () => {
  const { s, shortcuts } = system()
  hook(shortcuts)
  for (let i = 0; i < 5; i++) { s.pressed!(); clock += 30 }
  expect(start).toHaveBeenCalledTimes(1)
  expect(stop).not.toHaveBeenCalled()
})

it('leaves keys another app holds, and says so in the log', () => {
  const { shortcuts } = system(false)
  const r = hook(shortcuts)
  expect(r.registered).toBe(false)
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('taken by another app'))
  r.dispose()
  expect(shortcuts.unregister).not.toHaveBeenCalled()
})

it('gives the keys back on quit, once', () => {
  const { s, shortcuts } = system()
  const r = hook(shortcuts)
  r.dispose(); r.dispose()
  expect(s.unregistered).toEqual([RECORD_ACCELERATOR])
})

it('a failed start is logged, not thrown into the system', () => {
  const { s, shortcuts } = system()
  hookRecordShortcut({ shortcuts, active: () => null, start: () => { throw new Error('no mic') }, stop, now: () => clock })
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => s.pressed!()).not.toThrow()
  expect(error).toHaveBeenCalledWith('record shortcut failed', expect.any(Error))
})
