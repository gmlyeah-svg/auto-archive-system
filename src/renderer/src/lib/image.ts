export function imageUrl(relPath: string | null | undefined): string {
  if (!relPath) return ''
  return `archiveimg://img?p=${encodeURIComponent(relPath)}`
}
