import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from './router'

export default function Link({ to, onClick, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || rest.target === '_blank') return
    event.preventDefault()
    navigate(to)
  }
  return <a {...rest} href={to} onClick={handle}>{children}</a>
}
