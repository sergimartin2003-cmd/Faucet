import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'

export default function CountUp({ to, duration = 1400, suffix = '' }: { to: number; duration?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(() => (typeof window !== 'undefined' && prefersReducedMotion() ? to : 0))

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return
    let frame = 0
    const run = () => {
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))))
        if (progress < 1) frame = window.requestAnimationFrame(tick)
      }
      frame = window.requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); run() }
    }, { threshold: 0.6 })
    observer.observe(element)
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame) }
  }, [to, duration])

  return <span ref={ref}>{value.toLocaleString('es-ES')}{suffix}</span>
}
