// Scores live in localStorage only. Every access is guarded: storage can be blocked or empty.
const KEY = 'easygame:v1'

// Anything but a plain object (corrupt or foreign data) reads as empty, so a save never throws.
function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

// Kept by resetAll: play state, not a score (today's Word guess stays done).
const KEEP = ['_wordDaily']

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {}
}

const slot = (id, variant) => (variant ? `${id}:${variant}` : id)

export function getBest(id, variant) {
  return read()[slot(id, variant)]?.best ?? null
}

// Saves value if it beats the stored best. Returns { best, isNew }.
export function submitScore(id, variant, value, better = 'high') {
  const data = read()
  const key = slot(id, variant)
  const prev = data[key]?.best ?? null
  const isNew = prev === null || (better === 'high' ? value > prev : value < prev)
  const plays = (data[key]?.plays ?? 0) + 1
  data[key] = { best: isNew ? value : prev, plays }
  write(data)
  return { best: isNew ? value : prev, isNew }
}

export function getValue(name, fallback) {
  return read()[`_${name}`] ?? fallback
}

export function setValue(name, value) {
  const data = read()
  data[`_${name}`] = value
  write(data)
}

// True when anything resettable is stored (any mode's score, streaks).
export function hasScores() {
  return Object.keys(read()).some((k) => !KEEP.includes(k))
}

export function resetAll() {
  const data = read()
  write(Object.fromEntries(KEEP.filter((k) => k in data).map((k) => [k, data[k]])))
}
