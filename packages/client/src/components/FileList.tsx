import React, { useEffect, useState } from 'react'

interface ChangedFile {
  path: string
  status: string
}

interface Props {
  changeId: string
  cwd: string
}

export default function FileList({ changeId, cwd }: Props) {
  const [files, setFiles] = useState<ChangedFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/show/${changeId}?cwd=${encodeURIComponent(cwd)}`)
      .then((r) => r.json())
      .then((data) => setFiles(data))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [changeId, cwd])

  if (loading) return <div className="file-list-loading">loading...</div>
  if (files.length === 0) return <div className="file-list-empty">no changed files</div>

  return (
    <div className="file-list">
      {files.map((f) => (
        <div key={f.path} className="file-list-item">
          <span className={`file-status file-status--${f.status}`}>{f.status}</span>
          <span className="file-path">{f.path}</span>
        </div>
      ))}
    </div>
  )
}
