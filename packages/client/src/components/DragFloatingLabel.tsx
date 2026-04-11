import type { DragPreviewViewModel } from '../repo/useRepoScreen'

interface Props {
  preview: DragPreviewViewModel
}

export default function DragFloatingLabel({ preview }: Props) {
  return (
    <div
      className="drag-floating-label"
      style={{
        left: preview.x + 16,
        top: preview.y + 16,
      }}
    >
      {preview.label}
    </div>
  )
}
