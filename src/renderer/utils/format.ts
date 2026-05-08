export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const dateOnly = dateStr.split('T')[0]
  const [, m, d] = dateOnly.split('-')
  if (!m || !d) return dateStr
  return `${Number(m)}月${Number(d)}日`
}

export function formatDateFull(dateStr: string): string {
  if (!dateStr) return ''
  const dateOnly = dateStr.split('T')[0]
  const [y, m, d] = dateOnly.split('-')
  if (!y || !m || !d) return dateStr
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function truncate(title: string, max = 40): string {
  if (title.length <= max) return title
  return `${Array.from(title).slice(0, max).join('')}...`
}

const IPC_ERROR_PREFIX = /^Error invoking remote method '[^']+':\s*/

export function extractErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(IPC_ERROR_PREFIX, '')
}
