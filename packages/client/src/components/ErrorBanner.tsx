interface Props {
  message: string
  onClose: () => void
}

export default function ErrorBanner({ message, onClose }: Props) {
  return (
    <div className="error-banner">
      <span className="error-banner-text">{message}</span>
      <button className="error-banner-close" onClick={onClose}>✕</button>
    </div>
  )
}
