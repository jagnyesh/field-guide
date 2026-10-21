// Paths under the session's folder, shown relative to it; tools write them absolute.
export function relativeTo(cwd: string, text: string): string {
  if (!cwd) return text
  const prefix = cwd.endsWith('/') ? cwd : cwd + '/'
  return text.split(prefix).join('')
}
