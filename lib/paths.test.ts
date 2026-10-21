import { describe, expect, test } from 'claude-code/testing'
import { relativeTo } from './paths'

describe('Paths for display', () => {
  test('paths under the session folder show relative to it, anywhere in a line; others stay as they are', async () => {
    expect(relativeTo('/work/app', '/work/app/src/settings.ini')).toBe('src/settings.ini')
    expect(relativeTo('/work/app', 'cat /work/app/a.txt /etc/hosts')).toBe('cat a.txt /etc/hosts')
    expect(relativeTo('/work/app', '/work/application/x.py')).toBe('/work/application/x.py')
    expect(relativeTo('', '/work/app/a.txt')).toBe('/work/app/a.txt')
  })

  test('the session folder itself shows as "."', async () => {
    expect(relativeTo('/work/app', 'cd /work/app && pytest -q')).toBe('cd . && pytest -q')
  })
})

