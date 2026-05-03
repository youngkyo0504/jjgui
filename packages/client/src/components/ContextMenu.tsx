import { useEffect, useRef } from 'react'

type MenuItem =
  | { type?: 'item'; label: string; disabled?: boolean; onClick: () => void }
  | { type: 'separator' }

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Keep the menu inside the viewport.
  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let adjustedX = x
    let adjustedY = y
    if (rect.right > vw) adjustedX = vw - rect.width - 8
    if (rect.bottom > vh) adjustedY = vh - rect.height - 8
    if (adjustedX < 0) adjustedX = 8
    if (adjustedY < 0) adjustedY = 8
    if (adjustedX !== x || adjustedY !== y) {
      ref.current.style.left = adjustedX + 'px'
      ref.current.style.top = adjustedY + 'px'
    }
  })

  return (
    <div className="context-menu" ref={ref} style={{ left: x, top: y }}>
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <div key={`sep-${i}`} className="context-menu-separator" />
        ) : (
          <button
            key={item.label}
            className={`context-menu-item${item.disabled ? ' context-menu-item--disabled' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              item.onClick()
              onClose()
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
