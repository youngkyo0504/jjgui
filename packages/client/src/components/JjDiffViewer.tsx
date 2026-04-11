import { useEffect, useMemo, useRef, useState } from 'react'
import { getSingularPatch, processFile } from '@pierre/diffs'
import { FileDiff } from '@pierre/diffs/react'

interface Props {
  filePath: string
  oldPath?: string
  patch: string
  canExpandContext: boolean
  oldContent: string | null
  newContent: string | null
}

interface PierreTheme {
  type: 'dark' | 'light'
  css: string
}

const DIFF_THEMES = {
  dark: 'pierre-dark',
  light: 'github-light-high-contrast',
} as const

function getResolvedMode(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function readPierreTheme(): PierreTheme {
  const styles = getComputedStyle(document.documentElement)
  const bg = styles.getPropertyValue('--bg').trim() || '#1a1b26'
  const surface = styles.getPropertyValue('--bg-surface').trim() || '#24283b'
  const fg = styles.getPropertyValue('--fg').trim() || '#c0caf5'
  const fgDim = styles.getPropertyValue('--fg-dim').trim() || '#565f89'
  const border = styles.getPropertyValue('--border').trim() || '#292e42'

  return {
    type: getResolvedMode(),
    css: `
      :host, [data-diff], [data-file], [data-diffs-header], [data-error-wrapper], [data-virtualizer-buffer] {
        --diffs-bg: ${bg} !important;
        --diffs-fg: ${fg} !important;
        --diffs-dark-bg: ${bg};
        --diffs-light-bg: ${bg};
        --diffs-dark: ${fg};
        --diffs-light: ${fg};
      }
      pre, code {
        background-color: ${bg} !important;
        font-family: inherit !important;
        font-size: 12px !important;
        line-height: 1.55 !important;
      }
      [data-file-info] {
        background-color: ${surface} !important;
      }
      [data-column-number] {
        background-color: ${bg} !important;
        color: ${fgDim} !important;
      }
      [data-file], [data-diffs-header] {
        border-color: ${border} !important;
      }
    `,
  }
}

function useCompactLayout(): boolean {
  const [isCompact, setIsCompact] = useState(() => window.matchMedia('(max-width: 960px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)')
    const onChange = (event: MediaQueryListEvent) => setIsCompact(event.matches)
    setIsCompact(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isCompact
}

export default function JjDiffViewer({
  filePath,
  oldPath,
  patch,
  canExpandContext,
  oldContent,
  newContent,
}: Props) {
  const isCompact = useCompactLayout()
  const viewerRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<PierreTheme>(() => readPierreTheme())
  const fileDiff = useMemo(() => getSingularPatch(patch), [patch])

  const augmentedDiff = useMemo(() => {
    if (!canExpandContext || (oldContent == null && newContent == null)) {
      return fileDiff
    }

    try {
      return processFile(patch, {
        oldFile: oldContent != null ? { name: oldPath ?? filePath, contents: oldContent } : undefined,
        newFile: newContent != null ? { name: filePath, contents: newContent } : undefined,
      }) || fileDiff
    } catch {
      return fileDiff
    }
  }, [canExpandContext, fileDiff, filePath, newContent, oldContent, oldPath, patch])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setTheme(readPierreTheme())
    setTheme(readPierreTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    viewerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [filePath, patch])

  return (
    <div className="jj-diff-viewer" ref={viewerRef}>
      <FileDiff
        key={`${filePath}-${isCompact ? 'unified' : 'split'}`}
        fileDiff={augmentedDiff}
        options={{
          theme: DIFF_THEMES,
          themeType: theme.type,
          unsafeCSS: theme.css,
          diffStyle: isCompact ? 'unified' : 'split',
          overflow: 'scroll',
          diffIndicators: 'bars',
          lineDiffType: 'word',
          disableLineNumbers: false,
          disableBackground: false,
          hunkSeparators: 'line-info',
        }}
      />
    </div>
  )
}
