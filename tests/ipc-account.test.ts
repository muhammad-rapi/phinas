import { describe, expect, test, vi } from 'vitest'
import { createHandlers, type Deps } from '../src/main/ipc'

/** Just enough of the main-process wiring for the sign-in path. */
function setup(useAccount: (uid: string) => boolean) {
  const calls: string[] = []
  const host = { useAccount: vi.fn(useAccount), error: 'disk full', userId: null }
  const remote = {
    signIn: vi.fn(async () => undefined),
    session: vi.fn(async () => ({ userId: 'u1', email: 'u1@test' }))
  }
  const deps = {
    host,
    remote,
    cache: { clear: () => undefined },
    settings: { set: () => undefined, get: () => null },
    lastError: { value: 'old' },
    pullLibrary: vi.fn(async () => {
      calls.push('pull')
    }),
    notifyAccountChanged: vi.fn(() => {
      calls.push('notify')
    })
  } as unknown as Deps
  return { handlers: createHandlers(deps), deps, host, calls }
}

describe('sign-in', () => {
  test('opens the account library, pulls it, then tells the renderer', async () => {
    const { handlers, host, calls } = setup(() => true)
    await handlers.syncSignIn('a@b.c', 'pw')
    expect(host.useAccount).toHaveBeenCalledWith('u1')
    expect(calls).toEqual(['pull', 'notify'])
  })

  test('stops without pulling when the account library cannot be opened', async () => {
    const { handlers, deps, calls } = setup(() => false)
    await expect(handlers.syncSignIn('a@b.c', 'pw')).rejects.toThrow('disk full')
    expect(deps.pullLibrary).not.toHaveBeenCalled()
    expect(calls).toEqual(['notify'])
  })
})
