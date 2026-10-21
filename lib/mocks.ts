// Mocks at a boundary (database, HTTP, cloud SDK) can pass while the real thing behaves differently.
// Edit text is read here in memory only; what leaves is the module names (ADR 0003).

export const DEFAULT_BOUNDARY_MODULES: readonly string[] = [
  // Python: HTTP, databases, caches, cloud and API SDKs.
  'requests', 'httpx', 'urllib', 'urllib3', 'aiohttp', 'sqlalchemy', 'psycopg2', 'psycopg', 'pymongo', 'redis',
  'sqlite3', 'mysql', 'boto3', 'botocore', 'google.cloud', 'azure', 'stripe', 'openai', 'anthropic',
  // JavaScript: HTTP, databases, caches, cloud and API SDKs.
  'axios', 'node-fetch', 'got', 'undici', 'pg', 'mysql2', 'mongodb', 'mongoose', 'ioredis', 'knex', 'sequelize',
  'prisma', '@prisma', 'aws-sdk', '@aws-sdk', '@google-cloud', '@anthropic-ai', '@stripe',
]

// mock.patch("x"), @patch("x"), mocker.patch("x"), monkeypatch.setattr("x", ...), jest/vi.mock("x").
const BY_NAME = /\b(?:patch|patch\.dict|monkeypatch\.setattr|monkeypatch\.setitem|jest\.mock|jest\.doMock|vi\.mock|vi\.doMock)\(\s*(['"])([^'"]+)\1/g
// patch.object(x, "attr"), jest/vi.spyOn(x, "attr"), monkeypatch.setattr(x, "attr", ...).
const BY_OBJECT = /\b(?:patch\.object|jest\.spyOn|vi\.spyOn|monkeypatch\.setattr)\(\s*([A-Za-z_$][\w.$]*)\s*,/g

function targets(text: string): string[] {
  const found: { at: number; target: string }[] = []
  for (const m of text.matchAll(BY_NAME)) found.push({ at: m.index ?? 0, target: m[2] })
  for (const m of text.matchAll(BY_OBJECT)) found.push({ at: m.index ?? 0, target: m[1] })
  return found.sort((a, b) => a.at - b.at).map(f => f.target)
}

function joined(input: Readonly<Record<string, unknown>>, ...fields: string[]): string {
  const edits = Array.isArray(input.edits) ? (input.edits as Record<string, unknown>[]) : []
  return [input, ...edits]
    .flatMap(part => fields.map(field => part[field]))
    .filter((v): v is string => typeof v === 'string')
    .join('\n')
}

// The mock targets an edit leaves that weren't there before (a multiset difference).
export function addedMockTargets(input: Readonly<Record<string, unknown>>): string[] {
  const before = new Map<string, number>()
  for (const t of targets(joined(input, 'old_string'))) before.set(t, (before.get(t) ?? 0) + 1)
  const added: string[] = []
  for (const t of targets(joined(input, 'new_string', 'content', 'new_source'))) {
    const left = before.get(t) ?? 0
    if (left > 0) before.set(t, left - 1)
    else added.push(t)
  }
  return added
}

// The boundary modules the targets fall under, once each, in order.
export function boundaryTargets(found: readonly string[], modules: readonly string[]): string[] {
  const hits: string[] = []
  for (const target of found) {
    const module = modules.find(m => target === m || target.startsWith(m + '.') || target.startsWith(m + '/'))
    if (module && !hits.includes(module)) hits.push(module)
  }
  return hits
}
