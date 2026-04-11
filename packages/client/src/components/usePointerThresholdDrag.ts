import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { DragPointer } from '../repo/types'

interface CommitDropTarget {
  changeId?: string
  description?: string
}

interface PointerThresholdDragOptions {
  disabled?: boolean
  threshold?: number
  onDragStart(pointer: DragPointer): void
  onDragMove(pointer: DragPointer, target: CommitDropTarget | null): void
  onDragEnd(pointer: DragPointer, target: CommitDropTarget | null): void
  onDragCancel?(): void
}

function suppressNextClick(): () => void {
  const handler = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    window.removeEventListener('click', handler, true)
  }

  window.addEventListener('click', handler, true)
  return () => {
    window.removeEventListener('click', handler, true)
  }
}

function getCommitDropTarget(pointer: DragPointer): CommitDropTarget | null {
  const element = document.elementFromPoint(pointer.x, pointer.y)
  if (!(element instanceof HTMLElement)) return null

  const target = element.closest<HTMLElement>('[data-commit-drop-target="true"]')
  if (!target) return null

  return {
    changeId: target.dataset.changeId,
    description: target.dataset.description,
  }
}

export function usePointerThresholdDrag({
  disabled = false,
  threshold = 8,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: PointerThresholdDragOptions) {
  const cleanupRef = useRef<(() => void) | null>(null)
  const clearSuppressedClickRef = useRef<(() => void) | null>(null)

  useEffect(() => () => {
    cleanupRef.current?.()
    clearSuppressedClickRef.current?.()
  }, [])

  return useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0) return

    const startPointer = { x: event.clientX, y: event.clientY }
    let dragging = false
    const pointerId = event.pointerId

    const finish = () => {
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('pointercancel', handlePointerCancel, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.classList.remove('drag-interaction-active')
      cleanupRef.current = null
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return

      const pointer = { x: moveEvent.clientX, y: moveEvent.clientY }
      const dx = pointer.x - startPointer.x
      const dy = pointer.y - startPointer.y

      if (!dragging && Math.hypot(dx, dy) >= threshold) {
        dragging = true
        clearSuppressedClickRef.current?.()
        clearSuppressedClickRef.current = suppressNextClick()
        document.body.classList.add('drag-interaction-active')
        onDragStart(pointer)
      }

      if (!dragging) return

      moveEvent.preventDefault()
      onDragMove(pointer, getCommitDropTarget(pointer))
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return

      const pointer = { x: upEvent.clientX, y: upEvent.clientY }
      const target = dragging ? getCommitDropTarget(pointer) : null
      finish()

      if (!dragging) return

      setTimeout(() => {
        clearSuppressedClickRef.current?.()
        clearSuppressedClickRef.current = null
      }, 0)
      upEvent.preventDefault()
      onDragEnd(pointer, target)
    }

    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return

      const didDrag = dragging
      finish()
      if (didDrag) {
        setTimeout(() => {
          clearSuppressedClickRef.current?.()
          clearSuppressedClickRef.current = null
        }, 0)
        onDragCancel?.()
      }
    }

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape') return
      const didDrag = dragging
      finish()
      if (didDrag) {
        clearSuppressedClickRef.current?.()
        clearSuppressedClickRef.current = suppressNextClick()
        setTimeout(() => {
          clearSuppressedClickRef.current?.()
          clearSuppressedClickRef.current = null
        }, 0)
        keyEvent.preventDefault()
        keyEvent.stopPropagation()
        onDragCancel?.()
      }
    }

    cleanupRef.current?.()
    cleanupRef.current = finish
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('pointercancel', handlePointerCancel, true)
    document.addEventListener('keydown', handleKeyDown, true)
  }, [disabled, onDragCancel, onDragEnd, onDragMove, onDragStart, threshold])
}
