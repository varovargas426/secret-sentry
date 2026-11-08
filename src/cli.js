import { scanRepository } from './repository.js'
import { scanText } from './rules.js'

const help = `Usage: node src/cli.js [--json] [directory]
       node src/cli.js --demo [--json]

Scan files in a Git working tree. The directory defaults to the current one.
--demo   Scan a fictional two-line example in memory.
--json   Print a machine-readable report.
--help   Show this message.

Exit codes: 0 clean, 1 findings, 2 error or incomplete scan.`

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log(help)
    return 0
  }
  const json = args.includes('--json')
  const demo = args.includes('--demo')
  const paths = args.filter(arg => !arg.startsWith('-'))
  const unknown = args.some(arg => arg.startsWith('-') && !['--json', '--demo'].includes(arg))
  if (unknown || paths.length > 1 || (demo && paths.length)) {
    throw new Error('Invalid arguments. Run with --help for usage.')
  }

  let report
  if (demo) {
    const example = ['# Fictional credential', 'TOKEN=ghp_' + 'x'.repeat(36)].join('\n')
    report = { scannedFiles: 1, skippedFiles: 0, issues: [], findings: scanText('example.env', example) }
  } else {
    report = scanRepository(paths[0] ?? '.')
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    for (const { path, line, rule } of report.findings) {
      console.log(`${JSON.stringify(path)}:${line}  ${rule}`)
    }
    for (const { path, reason } of report.issues) {
      console.error(`Incomplete: ${JSON.stringify(path)} (${reason})`)
    }
    console.log(`Scanned: ${report.scannedFiles} | Skipped: ${report.skippedFiles} | Findings: ${report.findings.length} | Issues: ${report.issues.length}`)
  }
  if (report.issues.length) return 2
  return report.findings.length ? 1 : 0
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error) {
  console.error(error.code ? 'Scan failed. Check the directory and file permissions.' : error.message)
  process.exitCode = 2
}
