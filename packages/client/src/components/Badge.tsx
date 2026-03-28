import React from 'react'

interface Props {
  label: string
  variant: 'workspace' | 'bookmark' | 'conflict' | 'empty'
}

export default function Badge({ label, variant }: Props) {
  return <span className={`badge badge--${variant}`}>{label}</span>
}
