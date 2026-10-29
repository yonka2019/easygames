export const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const fmtMs = (ms) => `${Math.round(ms)} ms`

export function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}
