// Paths under the session's folder, shown relative to it; tools write them absolute.
// The folder itself shows as ".".
export function relativeTo(cwd: string, text: string): string {
  if (!cwd) return text
  const folder = cwd.replace(/\/$/, '')
  return text
    .split(folder + '/')
    .join('')
    .replace(new RegExp(`${folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s;&|)])`, 'g'), '.')
}
