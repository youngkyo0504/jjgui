import type { RepoEventsPort } from './ports'

export function createEventSourceRepoEvents(): RepoEventsPort {
  return {
    subscribe(cwd, onRefresh) {
      const es = new EventSource(`/api/events?cwd=${encodeURIComponent(cwd)}`)
      es.addEventListener('refresh', onRefresh)
      es.onerror = () => es.close()
      return () => es.close()
    },
  }
}
