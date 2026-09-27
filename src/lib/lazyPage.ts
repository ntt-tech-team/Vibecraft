import { lazy, type ComponentType } from 'react'

const KEY = 'vc26_chunk_reload_at'

/**
 * React.lazy that survives a redeploy: a tab opened before a new deploy may ask for code files
 * the new deploy no longer has. Instead of a broken page, reload once to get the new version.
 * (At most one reload a minute, so a genuinely missing file can't cause a reload loop.)
 */
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((err: unknown) => {
      let last = 0
      try {
        last = Number(sessionStorage.getItem(KEY) ?? 0)
      } catch {
        /* storage blocked: fall through to the error */
      }
      if (Date.now() - last > 60_000) {
        try {
          sessionStorage.setItem(KEY, String(Date.now()))
        } catch {
          /* ignore */
        }
        window.location.reload()
        return new Promise<{ default: T }>(() => {}) // keep showing the fallback while reloading
      }
      throw err
    }),
  )
}
