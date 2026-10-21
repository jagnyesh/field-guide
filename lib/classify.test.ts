import { describe, expect, test } from 'claude-code/testing'
import { classify } from './classify'

describe('Step Classifier', () => {
  test('tools that only look are read or search; tools that change files are edit; subagents are delegate', async () => {
    const kinds = [
      classify('Read', { file_path: 'a.py' }),
      classify('Grep', { pattern: 'x' }),
      classify('Glob', { pattern: '*.py' }),
      classify('Edit', { file_path: 'a.py' }),
      classify('Write', { file_path: 'a.py' }),
      classify('MultiEdit', { file_path: 'a.py' }),
      classify('NotebookEdit', { notebook_path: 'a.ipynb' }),
      classify('Agent', { description: 'x' }),
      classify('Task', { description: 'x' }),
      classify('SubagentHandback', {}),
      classify('TodoWrite', { todos: [] }),
    ]
    expect(kinds).toEqual(['read', 'search', 'search', 'edit', 'edit', 'edit', 'edit', 'delegate', 'delegate', 'delegate', 'other'])
  })

  const bash = (command: string, isReadOnly?: boolean) => classify('Bash', { command }, { isReadOnly })

  test('a shell command that prints files is a read; one that lists or greps is a search', async () => {
    expect(['cat src/a.py', "sed -n '1,40p' src/a.py", 'head -20 a.txt', 'cd sub && cat a.txt', 'cat a.txt | head -5'].map(c => bash(c)))
      .toEqual(['read', 'read', 'read', 'read', 'read'])
    expect(['rg greet src', 'grep -rn greet .', 'ls src', 'find . -name "*.py"', 'git status', 'git diff --stat'].map(c => bash(c)))
      .toEqual(['search', 'search', 'search', 'search', 'search', 'search'])
  })

  test('running tests, linters, type checkers, or builds is verify', async () => {
    const commands = [
      'pytest', '.venv/bin/python -m pytest -q', 'uv run pytest tests/', 'npx vitest run', 'npm test', 'npm run test:unit',
      'bun test', 'go test ./...', 'cargo test', 'ruff check .', 'mypy src', 'npx tsc --noEmit', 'npm run lint', 'cargo build',
    ]
    expect(commands.map(c => bash(c))).toEqual(commands.map(() => 'verify'))
  })

  test('an ad-hoc import or script, a write, or anything else is a run', async () => {
    expect([`python -c "import src.app"`, "sed -i 's/a/b/' a.py", 'echo hi > out.txt', 'cat a.txt > b.txt', 'make deploy', 'curl https://x'].map(c => bash(c)))
      .toEqual(['run', 'run', 'run', 'run', 'run', 'run'])
  })

  test('a command the engine says is not read-only is never a read or search', async () => {
    expect(bash('cat a.txt', false)).toBe('run')
    expect(bash('cat a.txt', true)).toBe('read')
  })
})
