import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isUtf8 } from 'node:buffer'
import { scanText } from './rules.js'

const maxBytes = 1024 * 1024

function git(directory, args) {
  try {
    return execFileSync('git', args, {
      cwd: directory,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    throw new Error('Could not list repository files. Check that Git is installed and the directory is inside a working tree.')
  }
}

export function scanRepository(directory) {
  const root = realpathSync(directory)
  const listing = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'])
  if (!isUtf8(listing)) throw new Error('The repository contains a filename that cannot be represented as UTF-8.')

  const paths = new Set(listing.toString('utf8').split('\0').filter(Boolean))
  const report = { scannedFiles: 0, skippedFiles: 0, issues: [], findings: [] }
  for (const path of [...paths].sort()) {
    const absolute = resolve(root, path)
    try {
      const info = lstatSync(absolute)
      // A tracked directory can be replaced with a symlink in the working tree.
      if (!info.isFile() || realpathSync(dirname(absolute)) !== dirname(absolute)) {
        report.skippedFiles++
        continue
      }
      if (info.size > maxBytes) {
        report.issues.push({ path, reason: 'exceeds the 1 MiB scan limit' })
        continue
      }
      const bytes = readFileSync(absolute)
      if (bytes.includes(0) || !isUtf8(bytes)) {
        report.skippedFiles++
        continue
      }
      report.findings.push(...scanText(path, bytes.toString('utf8')))
      report.scannedFiles++
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        report.skippedFiles++
      } else {
        report.issues.push({ path, reason: 'could not read file' })
      }
    }
  }
  return report
}
