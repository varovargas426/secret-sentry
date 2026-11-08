# Secret Sentry

Secret Sentry scans the files in a Git working tree for recognizable credential patterns. Run it before a push to find a classic GitHub token, an AWS access key ID, or a private key header. Each finding includes the file, line number, and matching rule. Matched values and surrounding source lines stay out of the report.

## Try the demo

Use Node.js 22 or later. The demo runs entirely in memory with a fictional token. No package installation or network connection is required.

```sh
node src/cli.js --demo
```

```text
"example.env":2  github-classic-token
Scanned: 1 | Skipped: 0 | Findings: 1 | Issues: 0
```

The demo exits with code 1 because it found the example token.

## Scan a repository

Install Git and run these commands from the Secret Sentry directory. Replace the example path with the Git repository or subdirectory you want to check.

```sh
node src/cli.js ../my-project
node src/cli.js --json ../my-project
```

Omit the path to scan the current directory. Use `--help` for the full CLI syntax.

| Exit code | Meaning |
| --- | --- |
| 0 | The scan completed with zero findings in the files it checked. |
| 1 | The scan completed and found at least one match. |
| 2 | An argument or repository error prevented the scan, or a file exceeded the size limit or could not be read. |

For an incomplete scan, review the issues alongside any findings. JSON reports provide `scannedFiles`, `skippedFiles`, `issues`, and `findings`. Startup and argument errors go to standard error.

## Detection rules

| Rule | What triggers it |
| --- | --- |
| `github-classic-token` | A `ghp_` prefix followed by 36 alphanumeric characters. |
| `aws-access-key-id` | An `AKIA` or `ASIA` prefix followed by 16 uppercase letters or digits. An ID can help locate related credentials. |
| `private-key-header` | A PEM-style private key opening marker, including OpenSSH, RSA, EC, DSA, and encrypted private keys. |

Rules match text offline. A match can be an example, a public identifier, or an active credential. Inspect the reported line locally. If a real token or private key was exposed, revoke or rotate it with its issuer. Review the repository history to determine where it appeared.

## Scan coverage

Secret Sentry asks Git for tracked files and untracked files allowed by Git's ignore rules. It reads their current contents on disk. A tracked file still gets scanned if a later ignore rule matches it.

- UTF-8 text files up to 1 MiB are eligible. Larger regular files produce an incomplete scan.
- Files containing a NUL byte, invalid UTF-8, missing tracked files, symlinks, and submodule directories count as skipped.
- Coverage ends at the working tree. Staged-only changes, past commits, archive contents, other token formats, and arbitrary passwords fall outside the scan.
- Each rule produces at most one finding per line. A clean report can still contain skipped files.

## Test and publish

Run the test suite from the project directory.

```sh
node --test
```

To publish a fresh copy, create an empty GitHub repository and replace `YOUR-ACCOUNT` and the repository name below with your own. Run the commands inside the folder that contains this README.

```sh
git init -b main
node src/cli.js
git add .
git commit -m "Add Secret Sentry scanner and tests"
git remote add origin https://github.com/YOUR-ACCOUNT/secret-sentry.git
git push -u origin main
```

The included GitHub Actions workflow runs the tests and scans the checked-out files on pushes and pull requests. A finding or incomplete scan fails the workflow.
