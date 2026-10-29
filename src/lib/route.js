import { useSyncExternalStore } from 'react'

// Tiny hash router: "#/" is home, "#/g/<id>" is a game.
function subscribe(cb) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const getHash = () => window.location.hash.replace(/^#/, '') || '/'

export function useRoute() {
  const path = useSyncExternalStore(subscribe, getHash, () => '/')
  const m = path.match(/^\/g\/([\w-]+)/)
  return m ? { page: 'game', id: m[1] } : { page: 'home' }
}

export const gameHref = (id) => `#/g/${id}`
