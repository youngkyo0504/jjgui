import { useEffect, useRef } from 'react'

interface MenuItem {
  label: string
  disabled?: boolean
  onClick: () => void
}

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

  return (
    <div className="context-menu" ref={ref} style={{ left: x, top: y }}>
      {items.map((item) => (
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
      ))}
    </div>
  )
}
