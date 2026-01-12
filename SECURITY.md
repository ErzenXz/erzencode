# Security Policy

## Supported Versions

Currently supported versions with security updates:

| Version | Supported          |
|---------|--------------------|
| 0.2.x   | :white_check_mark: |

## Reporting a Vulnerability

The erzencode team and community take security bugs seriously. We appreciate your efforts to responsibly disclose your findings.

If you discover a security vulnerability, please **DO NOT** open a public issue.

### How to Report

Send an email to the project maintainer:

**Email:** [INSERT YOUR EMAIL]

Include the following information in your report:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Any suggested mitigations or fixes

### What to Expect

1. **Acknowledgment**: You will receive an acknowledgment of your report within 48 hours
2. **Investigation**: We will investigate the vulnerability and determine its severity
3. **Resolution**: We will work on a fix and coordinate a release with you
4. **Disclosure**: We will publicly disclose the vulnerability once a fix is available

### Security Best Practices for Users

- Never share your API keys or commit them to version control
- Always use environment variables for sensitive configuration
- Review code execution prompts before approving commands
- Keep erzencode updated to the latest version
- Use `ask` mode when you don't need file write access
- Review the `.erzencodeignore` file to exclude sensitive directories

### Known Security Considerations

- erzencode executes shell commands based on AI responses - always review commands
- File operations are scoped to your workspace but be mindful of destructive operations
- API keys are stored locally in plain text - protect your config directory
- Web UI runs on localhost and is not intended for remote access

### Security Auditing

To audit the dependencies:

```bash
pnpm audit
```

To check for outdated packages:

```bash
pnpm outdated
```
