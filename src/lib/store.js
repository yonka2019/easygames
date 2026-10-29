// Scores live in localStorage only. Every access is guarded: storage can be blocked or empty.
const KEY = 'easygame:v1'

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

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

export function totalPlays() {
  return Object.entries(read()).reduce((n, [k, v]) => (k.startsWith('_') ? n : n + (v?.plays ?? 0)), 0)
}

export function resetAll() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
