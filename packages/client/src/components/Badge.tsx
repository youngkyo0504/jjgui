import React from 'react'

interface Props {
  label: string
  variant: 'workspace' | 'bookmark' | 'bookmark-remote' | 'conflict' | 'empty' | 'editing' | 'divergent'
}

export default function Badge({ label, variant }: Props) {
  return <span className={`badge badge--${variant}`}>{label}</span>
}
