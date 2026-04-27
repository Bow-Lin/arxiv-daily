export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const dateOnly = dateStr.split('T')[0]
  const [, m, d] = dateOnly.split('-')
  if (!m || !d) return dateStr
  return `${Number(m)}月${Number(d)}日`
}

export function truncate(title: string, max = 40): string {
  if (title.length <= max) return title
  return `${Array.from(title).slice(0, max).join('')}...`
}
