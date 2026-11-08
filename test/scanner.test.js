import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { scanText } from '../src/rules.js'

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url))
const fakeToken = 'ghp_' + 'x'.repeat(36)
const fakeId = 'ASIA' + 'Z'.repeat(16)

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'secret-sentry-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  execFileSync('git', ['init', '--quiet', cwd])
  return cwd
}

function run(cwd, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' })
  assert.ifError(result.error)
  return result
}

test('reports each matching rule once per line with one-based locations', () => {
  const header = ['-----BEGIN', 'OPENSSH PRIVATE KEY-----'].join(' ')
  const data = ['ordinary text', fakeToken + ' ' + fakeToken + ' ' + fakeId, header].join('\r\n')
  assert.deepEqual(scanText('keys.txt', data), [
    { path: 'keys.txt', line: 2, rule: 'github-classic-token' },
    { path: 'keys.txt', line: 2, rule: 'aws-access-key-id' },
    { path: 'keys.txt', line: 3, rule: 'private-key-header' },
  ])
})

test('ignores partial and overlong identifiers', () => {
  assert.deepEqual(scanText('sample', [fakeToken.slice(0, -1), fakeToken + 'a', fakeId + 'Z'].join('\n')), [])
})

test('scans tracked and untracked files, honors ignore rules, and redacts content', t => {
  const cwd = repository(t)
  writeFileSync(join(cwd, '.gitignore'), 'local.env\ntracked.env\n')
  for (const path of ['local.env', 'tracked.env', 'new file.txt']) {
    writeFileSync(join(cwd, path), fakeToken)
  }
  execFileSync('git', ['add', '-f', 'tracked.env'], { cwd })
  writeFileSync(join(cwd, 'binary.bin'), Buffer.from('\0' + fakeToken))
  const result = run(cwd, '--json')
  assert.equal(result.status, 1, result.stderr)
  assert.ok(!result.stdout.includes(fakeToken))
  const report = JSON.parse(result.stdout)
  assert.deepEqual(report.findings.map(f => f.path), ['new file.txt', 'tracked.env'])
  assert.equal(report.skippedFiles, 1)
  assert.ok(!run(cwd).stdout.includes(fakeToken))
})

test('a subdirectory scan reads only its current working-tree contents', t => {
  const cwd = repository(t)
  mkdirSync(join(cwd, 'src'))
  writeFileSync(join(cwd, 'outside.txt'), fakeToken)
  const inside = join(cwd, 'src', 'inside.txt')
  writeFileSync(inside, fakeToken)
  execFileSync('git', ['add', 'src'], { cwd })
  writeFileSync(inside, 'updated')
  const result = run(cwd, 'src', '--json')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).scannedFiles, 1)
})

test('an oversized file makes the scan incomplete even when another file matches', t => {
  const cwd = repository(t)
  writeFileSync(join(cwd, 'large.txt'), Buffer.alloc(1024 * 1024 + 1, 65))
  writeFileSync(join(cwd, 'small.env'), fakeId)
  const result = run(cwd, '--json')
  assert.equal(result.status, 2)
  const report = JSON.parse(result.stdout)
  assert.equal(report.issues[0].path, 'large.txt')
  assert.equal(report.findings.length, 1)
})

test('demo, help, and invalid options expose the documented exit codes', () => {
  assert.equal(run('.', '--demo').status, 1)
  assert.equal(run('.', '--help').status, 0)
  assert.equal(run('.', '--invalid').status, 2)
})
