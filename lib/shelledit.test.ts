import { describe, expect, test } from 'claude-code/testing'
import { creditChanges, guessWrites } from './shelledit'

describe('Shell edits: best guess from the command text', () => {
  test('redirection, tee, and in-place edits name the files they write', async () => {
    expect(guessWrites('echo x > out.txt')).toEqual(['out.txt'])
    expect(guessWrites('printf "a" >> logs/app.log 2>&1')).toEqual(['logs/app.log'])
    expect(guessWrites("cat > src/new.py <<'EOF'\nprint(1)\nEOF")).toEqual(['src/new.py'])
    expect(guessWrites('make 2>/dev/null | tee build.log notes.txt')).toEqual(['build.log', 'notes.txt'])
    expect(guessWrites("sed -i '' 's/a/b/' src/a.py src/b.py")).toEqual(['src/a.py', 'src/b.py'])
    expect(guessWrites("sed -i.bak -e 's/a/b/' src/a.py")).toEqual(['src/a.py'])
    expect(guessWrites("perl -pi -e 's/a/b/' src/a.py")).toEqual(['src/a.py'])
  })

  test('copies, moves, new files, and deletions name what they change', async () => {
    expect(guessWrites('cp src/a.py src/b.py')).toEqual(['src/b.py'])
    expect(guessWrites('mv src/old.py src/new.py')).toEqual(['src/old.py', 'src/new.py'])
    expect(guessWrites('touch src/__init__.py && rm -f build/x.o')).toEqual(['src/__init__.py', 'build/x.o'])
  })

  test('commands that only read, or whose writes the text cannot show, name nothing', async () => {
    expect(guessWrites('cat a.txt | grep x')).toEqual([])
    expect(guessWrites("sed -n '1,5p' a.txt")).toEqual([])
    expect(guessWrites('python - <<EOF\nopen("x","w").write("y")\nEOF')).toEqual([])
    expect(guessWrites('pytest -q 2>&1')).toEqual([])
  })
})

describe('Shell edits: exact, from the repository change list', () => {
  // `git status --porcelain -z -uall` output: "XY path" entries separated by NUL.
  const status = (...entries: string[]) => entries.map(e => e + '\0').join('')
  const call = { start: 1_000, end: 2_000 }

  test('a file changed during the call is credited to it; one changed before it is not', async () => {
    const after = status(' M src/a.py', ' M src/b.py', '?? src/new.py')
    const mtimes: Record<string, number> = { 'src/a.py': 1_500, 'src/b.py': 400, 'src/new.py': 1_900 }
    expect(creditChanges({ after, previous: '', mtimeOf: path => mtimes[path], ...call })).toEqual(['src/a.py', 'src/new.py'])
  })

  test('a deletion is credited only if it is new since the previous snapshot', async () => {
    const previous = status(' D src/gone-before.py')
    const after = status(' D src/gone-before.py', ' D src/gone-now.py')
    expect(creditChanges({ after, previous, mtimeOf: () => undefined, ...call })).toEqual(['src/gone-now.py'])
  })

  test('a rename credits the new path', async () => {
    const after = 'R  src/new_name.py\0src/old_name.py\0'
    expect(creditChanges({ after, previous: '', mtimeOf: () => 1_200, ...call })).toEqual(['src/new_name.py'])
  })
})

