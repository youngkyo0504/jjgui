export interface ChangedFile {
  path: string
  status: string
}

export type RebasePhase = 'idle' | 'source-selected' | 'confirming' | 'executing'

export interface RebaseState {
  phase: RebasePhase
  sourceChangeId?: string
  sourceDescription?: string
  destinationChangeId?: string
  destinationDescription?: string
  descendants?: Set<string>
  lastAction?: 'rebase'
  beforeOpId?: string
}

export type MoveChangesPhase = 'idle' | 'selecting-destination' | 'confirming' | 'executing'

export interface MoveChangesState {
  phase: MoveChangesPhase
  fromChangeId?: string
  selectedPaths?: string[]
  toChangeId?: string
  toDescription?: string
  lastAction?: 'move-changes' | 'split' | 'squash' | 'discard-file'
  beforeOpId?: string
}

export type FetchPhase = 'idle' | 'executing'

export interface FetchRemoteResult {
  remote: string
  ok: boolean
  output: string
}

export interface FetchState {
  phase: FetchPhase
  results?: FetchRemoteResult[]
  beforeOpId?: string | null
}

export type PushScope = 'bookmark' | 'subtree'

export interface PushResult {
  type: 'success' | 'error' | 'info'
  message: string
  reviewUrl?: string | null
}
