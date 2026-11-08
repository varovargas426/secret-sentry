// Report rule IDs and locations only. Never retain the matched value.
const rules = [
  {
    id: 'github-classic-token',
    pattern: /\bghp_[A-Za-z0-9]{36}\b/,
  },
  {
    id: 'aws-access-key-id',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    id: 'private-key-header',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
  },
]

export function scanText(path, content) {
  const findings = []
  const lines = content.split(/\r\n|\n|\r/)
  for (const [index, line] of lines.entries()) {
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        findings.push({ path, line: index + 1, rule: rule.id })
      }
    }
  }
  return findings
}
