import { basename, segments } from './shell'

function positionals(args: readonly string[]): string[] {
  return args.filter(arg => arg !== '' && !arg.startsWith('-'))
}

// The files an in-place `sed` edits: everything after its script, skipping options and BSD's `-i ''`.
function sedFiles(args: readonly string[]): string[] {
  if (!args.some(arg => arg.startsWith('-i'))) return []
  const files: string[] = []
  let script = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-i' && args[i + 1] === '') i++
    else if (arg === '-e' || arg === '-f') {
      script = true
      i++
    } else if (arg.startsWith('-')) continue
    else if (!script) script = true
    else files.push(arg)
  }
  return files
}

function perlFiles(args: readonly string[]): string[] {
  if (!args.some(arg => /^-[a-zA-Z]*i/.test(arg))) return []
  const at = args.findIndex(arg => /^-[a-zA-Z]*e$/.test(arg))
  return at === -1 ? [] : positionals(args.slice(at + 2))
}

// Files a shell command writes, moves, creates, or deletes, as far as its text shows.
// A script that writes files (`python - <<EOF`) shows nothing here.
export function guessWrites(command: string): string[] {
  const found: string[] = []
  for (const segment of segments(command)) {
    found.push(...segment.redirectTargets)
    const [program, ...args] = segment.argv
    switch (basename(program ?? '')) {
      case 'tee':
        found.push(...positionals(args))
        break
      case 'sed':
        found.push(...sedFiles(args))
        break
      case 'perl':
        found.push(...perlFiles(args))
        break
      case 'cp': {
        const paths = positionals(args)
        if (paths.length >= 2) found.push(paths[paths.length - 1])
        break
      }
      case 'mv':
      case 'touch':
      case 'rm':
        found.push(...positionals(args))
        break
    }
  }
  return [...new Set(found)]
}

type StatusEntry = { readonly status: string; readonly path: string }

// `git status --porcelain -z`: "XY path" entries separated by NUL; a rename or copy is followed
// by one more entry holding its old path.
export function parseStatus(output: string): StatusEntry[] {
  const parts = output.split('\0')
  const entries: StatusEntry[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.length < 4) continue
    const status = part.slice(0, 2)
    entries.push({ status, path: part.slice(3) })
    if (status[0] === 'R' || status[0] === 'C') i++
  }
  return entries
}

export type CreditInput = {
  // The change list after the call, and the one before (the previous call's, when there was one).
  readonly after: string
  readonly previous: string
  readonly mtimeOf: (path: string) => number | undefined
  readonly start: number
  readonly end: number
}

// The files a shell call changed: listed as changed after it, and modified while it ran.
// A file changed at the same moment by someone else (the developer's editor) can't be told apart.
export function creditChanges({ after, previous, mtimeOf, start, end }: CreditInput): string[] {
  const deletedBefore = new Set(parseStatus(previous).filter(e => e.status.includes('D')).map(e => e.path))
  const credited: string[] = []
  for (const entry of parseStatus(after)) {
    if (entry.status.includes('D')) {
      if (!deletedBefore.has(entry.path)) credited.push(entry.path)
      continue
    }
    const mtime = mtimeOf(entry.path)
    if (mtime !== undefined && mtime >= start && mtime <= end) credited.push(entry.path)
  }
  return credited
}
