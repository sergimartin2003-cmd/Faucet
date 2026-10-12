import { useEffect, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Drives scroll parallax, mouse parallax and the scroll progress CSS variables on `root`.
 *  - `[data-depth="0.2"]`: translates along Y relative to the viewport centre (--py).
 *  - `--mx`/`--my` (-1..1) are eased towards the pointer position inside `[data-mouse-scope]`.
 */
export function useParallax(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    const applied = new Map<HTMLElement, number>()
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let frame = 0
    let scrollDirty = true

    const update = () => {
      frame = 0
      const viewportCentre = window.innerHeight / 2
      if (scrollDirty) {
        scrollDirty = false
        const max = document.documentElement.scrollHeight - window.innerHeight
        root.style.setProperty('--scroll', String(Math.round(window.scrollY)))
        root.style.setProperty('--progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0))
        root.classList.toggle('is-scrolled', window.scrollY > 12)
        root.querySelectorAll<HTMLElement>('[data-depth]').forEach((element) => {
          const previous = applied.get(element) ?? 0
          const rect = element.getBoundingClientRect()
          if (rect.bottom < -400 || rect.top > window.innerHeight + 400) return
          const baseCentre = rect.top + rect.height / 2 - previous
          const offset = (baseCentre - viewportCentre) * Number(element.dataset.depth ?? 0)
          applied.set(element, offset)
          element.style.setProperty('--py', `${offset.toFixed(1)}px`)
        })
      }
      current.x += (target.x - current.x) * 0.08
      current.y += (target.y - current.y) * 0.08
      const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001
      root.style.setProperty('--mx', current.x.toFixed(3))
      root.style.setProperty('--my', current.y.toFixed(3))
      if (!settled) schedule()
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    const onScroll = () => { scrollDirty = true; schedule() }
    const onPointerMove = (event: PointerEvent) => {
      target.x = (event.clientX / window.innerWidth - 0.5) * 2
      target.y = (event.clientY / window.innerHeight - 0.5) * 2
      schedule()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('pointermove', onPointerMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [rootRef])
}

/** Adds `.in` to every `[data-reveal]` element once it enters the viewport. */
export function useReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('in'))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('in')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [rootRef])
}

/** Cursor spotlight + 3D tilt: write pointer position into CSS variables of the hovered card. */
export function useCardPointer(selector: string) {
  return {
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>(selector)
      if (!card) return
      const rect = card.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      card.style.setProperty('--sx', `${x}px`)
      card.style.setProperty('--sy', `${y}px`)
      card.style.setProperty('--rx', `${((0.5 - y / rect.height) * 6).toFixed(2)}deg`)
      card.style.setProperty('--ry', `${((x / rect.width - 0.5) * 8).toFixed(2)}deg`)
    },
    onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => {
      event.currentTarget.querySelectorAll<HTMLElement>(selector).forEach((card) => {
        card.style.setProperty('--rx', '0deg')
        card.style.setProperty('--ry', '0deg')
      })
    },
  }
}
