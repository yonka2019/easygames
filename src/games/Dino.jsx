import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cssVar } from '../lib/util'
import { CACTI, CLAUDE_ORANGE, CPX, GRAVITY, JUMP, DINO_X, DUCK, DUCK_H, DUCK_W, FLY_H, FLY_W, GROUND, H, RUN, STAND, STAND_H, STAND_W, W, drawCactus, drawFly, drawSprite } from './claudeArt'
import { useGame } from '../components/GameFrame'
import { Button, EASE, Kbd, Swap } from '../components/ui'

// Claude run: offline-dino style runner (Claude jumps cacti, dodges flying bugs). Fixed logical world (W × H), scaled to the canvas; physics in px/s with frame delta.
const HOLD_GRAVITY = 1500 // lighter gravity while the jump key is held (first HOLD_S seconds)
const HOLD_S = 0.16
const DROP_GRAVITY = 6000 // ducking in the air drops fast
const START_SPEED = 330
const MAX_SPEED = 820
const ACCEL = 8
const BIRDS_FROM = 200

// Flying patterns: low = only a jump clears it (ducking won't), mid = duck or jump, high = run under, bob = drifts up and down.
const FLIGHTS = [
  { y: GROUND - FLY_H - 1, w: 0.32 },
  { y: GROUND - 18 - FLY_H, w: 0.33 },
  { y: GROUND - 34 - FLY_H, w: 0.15 },
  { y: GROUND - 26 - FLY_H, w: 0.2, bob: 12 },
]

function spawn(speed, score) {
  if (score > BIRDS_FROM && Math.random() < 0.3) {
    let r = Math.random()
    const f = FLIGHTS.find((x) => (r -= x.w) < 0) ?? FLIGHTS[0]
    return { kind: 'fly', x: W + 20, y: f.y, base: f.y, bob: f.bob ?? 0, phase: Math.random() * 6, w: FLY_W, h: FLY_H }
  }
  const size = CACTI[Math.random() < 0.55 ? 0 : 1]
  const count = speed > 500 ? 1 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2)
  const w = size.w * count + (count - 1) * 4
  return { kind: 'cactus', x: W + 20, y: GROUND - size.h, w, h: size.h, unit: size.w, count }
}

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function fresh() {
  return {
    t: 0,
    speed: START_SPEED,
    dist: 0,
    y: 0, // height above ground (0 = on ground), grows upward
    vy: 0,
    air: 0,
    hold: false,
    duck: false,
    obs: [],
    next: W * 0.9,
    clouds: [
      { x: 120, y: 34 },
      { x: 380, y: 22 },
      { x: 560, y: 48 },
    ],
    bumps: Array.from({ length: 14 }, (_, i) => ({ x: i * 46 + Math.random() * 30, w: 2 + Math.random() * 4 })),
    flash: 0,
  }
}

export default function Dino() {
  const { report } = useGame()
  const canvas = useRef(null)
  const world = useRef(fresh())
  const colors = useRef(null)
  const statusRef = useRef('idle')
  const [status, setStatus] = useState('idle') // idle | run | over
  const [final, setFinal] = useState({ score: 0, isNew: false })
  const swipe = useRef(null)

  const setStat = (s) => {
    statusRef.current = s
    setStatus(s)
  }

  const readColors = () => {
    colors.current = { ink: cssVar('--text'), danger: cssVar('--danger'), muted: cssVar('--muted'), line: cssVar('--line') }
  }

  const draw = useCallback(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const cw = c.clientWidth
    if (c.width !== Math.round(cw * dpr)) {
      c.width = Math.round(cw * dpr)
      c.height = Math.round(cw * (H / W) * dpr)
    }
    if (!colors.current) readColors()
    const k = colors.current
    const g = world.current
    const s = (cw / W) * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(s, 0, 0, s, 0, 0)

    // Clouds (slow parallax)
    ctx.fillStyle = k.line
    g.clouds.forEach((cl) => {
      ctx.fillRect(cl.x, cl.y, 34, 6)
      ctx.fillRect(cl.x + 6, cl.y - 5, 18, 5)
    })

    // Ground
    ctx.fillStyle = k.muted
    ctx.fillRect(0, GROUND, W, 1.5)
    g.bumps.forEach((b) => ctx.fillRect(b.x, GROUND + 5, b.w, 1.5))

    // Cacti (ink) and flying bugs (red)
    g.obs.forEach((o) => {
      ctx.fillStyle = o.kind === 'fly' ? k.danger : k.ink
      if (o.kind === 'fly') drawFly(ctx, o, g.t)
      else drawCactus(ctx, o)
    })

    // Claude
    ctx.fillStyle = CLAUDE_ORANGE
    const running = statusRef.current === 'run' && g.y === 0
    const frame = Math.floor(g.t * 10) % 2
    if (g.duck && g.y === 0) drawSprite(ctx, DUCK[running ? frame : 0], DINO_X, GROUND - DUCK_H, CPX)
    else drawSprite(ctx, running ? RUN[frame] : STAND, DINO_X, GROUND - STAND_H - g.y, CPX)

    // Score (blinks every 100 points)
    const score = Math.floor(g.dist * 0.025)
    const blink = g.flash > 0 && Math.floor(g.flash * 8) % 2 === 0
    if (!blink) {
      ctx.fillStyle = k.muted
      ctx.font = `600 13px ${cssVar('--font-mono') || 'monospace'}`
      ctx.textAlign = 'right'
      ctx.fillText(String(score).padStart(5, '0'), W - 10, 20)
    }
  }, [])

  const step = useCallback((dt) => {
    const g = world.current
    g.t += dt
    g.speed = Math.min(MAX_SPEED, g.speed + ACCEL * dt)
    const dx = g.speed * dt
    const before = Math.floor(g.dist * 0.025)
    g.dist += dx
    const score = Math.floor(g.dist * 0.025)
    if (Math.floor(score / 100) > Math.floor(before / 100)) g.flash = 0.8
    g.flash = Math.max(0, g.flash - dt)

    // Jump physics
    if (g.y > 0 || g.vy < 0) {
      g.air += dt
      const grav = g.duck ? DROP_GRAVITY : g.hold && g.vy < 0 && g.air < HOLD_S ? HOLD_GRAVITY : GRAVITY
      g.vy += grav * dt
      g.y -= g.vy * dt
      if (g.y <= 0) {
        g.y = 0
        g.vy = 0
      }
    }

    // World scroll
    g.obs.forEach((o) => {
      o.x -= o.kind === 'fly' ? dx * 1.08 : dx
      if (o.bob) o.y = o.base + Math.sin(g.t * 4 + o.phase) * o.bob
    })
    g.obs = g.obs.filter((o) => o.x + o.w > -10)
    g.next -= dx
    if (g.next <= 0) {
      g.obs.push(spawn(g.speed, score))
      g.next = g.speed * (0.75 + Math.random() * 0.8) + 140
    }
    g.clouds.forEach((cl) => {
      cl.x -= dx * 0.2
      if (cl.x < -40) {
        cl.x = W + Math.random() * 80
        cl.y = 18 + Math.random() * 40
      }
    })
    g.bumps.forEach((b) => {
      b.x -= dx
      if (b.x < -8) b.x += W + 40
    })

    // Collision (hitboxes a bit smaller than the sprites, like the original)
    const ducking = g.duck && g.y === 0
    const box = ducking
      ? { x: DINO_X + 3, y: GROUND - DUCK_H + 3, w: DUCK_W - 6, h: DUCK_H - 3 }
      : { x: DINO_X + 3, y: GROUND - STAND_H - g.y + 3, w: STAND_W - 6, h: STAND_H - 3 }
    return g.obs.some((o) => hit(box, { x: o.x + 2, y: o.y + 2, w: o.w - 4, h: o.h - 2 }))
  }, [])

  // Main loop: runs only while playing. Delta is clamped so a background tab doesn't teleport the world.
  useEffect(() => {
    if (status !== 'run') return
    let id
    let last = performance.now()
    let tick = 0
    const loop = (now) => {
      // rAF's timestamp can be a hair before `last` on the first frame: never step backwards.
      const dt = Math.max(0, Math.min(0.033, (now - last) / 1000))
      last = now
      if (++tick % 30 === 0) readColors()
      if (step(dt)) {
        draw()
        const score = Math.floor(world.current.dist * 0.025)
        const r = report(score)
        setFinal({ score, isNew: r.isNew })
        setStat('over')
        return
      }
      draw()
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [status, step, draw, report])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(() => {
      readColors()
      draw()
    })
    ro.observe(canvas.current)
    const mo = new MutationObserver(() => {
      readColors()
      draw()
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [draw])

  const start = useCallback(() => {
    world.current = fresh()
    readColors()
    setStat('run')
  }, [])

  const jump = useCallback(() => {
    const g = world.current
    if (statusRef.current !== 'run') return start()
    if (g.y === 0 && g.vy === 0 && !g.duck) {
      g.vy = JUMP
      g.air = 0
      g.y = 0.01
    }
    g.hold = true
  }, [start])

  const release = () => {
    world.current.hold = false
  }
  const duck = (on) => {
    if (statusRef.current === 'run') world.current.duck = on
  }

  useEffect(() => {
    const down = (e) => {
      if (e.repeat && e.code !== 'ArrowDown') return
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w') {
        e.preventDefault()
        if (statusRef.current === 'over' && e.code !== 'Space') return
        jump()
      } else if (e.code === 'ArrowDown' || e.key === 's') {
        e.preventDefault()
        duck(true)
      } else if (e.key === 'Enter' && statusRef.current === 'over') {
        e.preventDefault()
        start()
      }
    }
    const up = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w') release()
      if (e.code === 'ArrowDown' || e.key === 's') duck(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [jump, start])

  // Touch: tap = jump (hold for higher), swipe down = duck.
  const onPointerDown = (e) => {
    swipe.current = { y: e.clientY }
    if (e.pointerType === 'mouse' && statusRef.current === 'run') return jump()
    if (e.pointerType !== 'mouse') jump()
  }
  const onPointerMove = (e) => {
    if (swipe.current && e.clientY - swipe.current.y > 24) duck(true)
  }
  const onPointerUp = () => {
    swipe.current = null
    release()
    duck(false)
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <div
        className="relative touch-none select-none overflow-hidden rounded-xl border border-line bg-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvas} className="block w-full" style={{ aspectRatio: `${W} / ${H}` }} aria-label="Claude run" />
        <AnimatePresence>
          {status !== 'run' && (
            <motion.div
              key="overlay"
              className={`absolute inset-0 grid place-items-center ${status === 'over' ? 'bg-surface/80' : ''}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <Swap k={status}>
                {status === 'over' ? (
                  <div className="text-center">
                    <p className="text-2xl font-semibold tracking-tight">Game over</p>
                    <p className="num mt-1 text-muted">
                      {final.score} pts{final.isNew ? ', new best' : ''}
                    </p>
                    <Button className="mt-4" onClick={start}>
                      Run again
                    </Button>
                  </div>
                ) : (
                  <button type="button" onClick={start} className="rounded-xl border border-line bg-surface/90 px-4 py-2 text-sm">
                    Press <Kbd>Space</Kbd> or tap to run
                  </button>
                )}
              </Swap>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
        <Kbd>Space</Kbd> or <Kbd>↑</Kbd> jump (hold = higher). <Kbd>↓</Kbd> duck. Swipe down on touch.
      </p>
    </div>
  )
}
