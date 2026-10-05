import type { AnchorHTMLAttributes, MouseEvent } from 'react'

import { navigate } from '../router'

/** An in-app link: a real <a href> that navigates without a page load. */
export function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    navigate(href)
  }
  return <a href={href} onClick={handle} {...props} />
}
