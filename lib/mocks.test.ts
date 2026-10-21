import { describe, expect, test } from 'claude-code/testing'
import { DEFAULT_BOUNDARY_MODULES, addedMockTargets, boundaryTargets } from './mocks'

describe('Boundary mock: what an edit mocks', () => {
  test('finds the mock and patch targets an edit adds, in Python and JavaScript styles', async () => {
    const added = addedMockTargets({
      old_string: '',
      new_string: [
        '@patch("requests.get")',
        'with mock.patch("sqlalchemy.orm.Session.execute") as fake:',
        'monkeypatch.setattr("boto3.client", fake)',
        'mocker.patch.object(httpx, "get")',
        "jest.mock('axios')",
        "vi.mock('pg', () => ({}))",
        "jest.spyOn(stripe.charges, 'create')",
        'patch("src.lookup.KNOWN", {})',
      ].join('\n'),
    })
    expect(added).toEqual(['requests.get', 'sqlalchemy.orm.Session.execute', 'boto3.client', 'httpx', 'axios', 'pg', 'stripe.charges', 'src.lookup.KNOWN'])
  })

  test('counts only mocks the edit adds, not ones already there', async () => {
    const before = '@patch("requests.get")\ndef test_a(): ...'
    expect(addedMockTargets({ old_string: before, new_string: before + '\n@patch("requests.get")\ndef test_b(): ...' })).toEqual(['requests.get'])
    expect(addedMockTargets({ old_string: before, new_string: before.replace('test_a', 'test_renamed') })).toEqual([])
  })

  test('a target is a boundary when it falls under a listed module; project code is not', async () => {
    expect(boundaryTargets(['requests.get', 'src.lookup.KNOWN', 'axios', '@aws-sdk/client-s3', 'pg'], DEFAULT_BOUNDARY_MODULES)).toEqual([
      'requests',
      'axios',
      '@aws-sdk',
      'pg',
    ])
  })
})
