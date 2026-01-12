# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-01-12

### Added
- **Conventional Commits**: Automated commit message enforcement with commitlint
- **Semantic Release**: Fully automated versioning and changelog generation
- **CI/CD Improvements**:
  - Migrated from npm to pnpm for faster installs
  - Added commit message validation in CI
  - Added TypeScript type checking
  - Added security audit workflow
- **Developer Experience**:
  - GitHub issue templates (Bug Report, Feature Request)
  - Pull request template with checklist
  - Enhanced contribution guidelines with commit standards
- **Community**:
  - Code of Conduct (Contributor Covenant)
  - Security policy with vulnerability reporting guidelines
  - Funding configuration for community sponsorships
- **Documentation**:
  - Comprehensive README with badges and feature overview
  - Initial CHANGELOG.md following Keep a Changelog format
  - Added more keywords for npm discoverability (gpt, llm, developer-tools, pair-programming)
- **New npm scripts**: `commit`, `lint:commit`, `release`

### Changed
- Updated CI workflows to use pnpm instead of npm
- Improved release workflow with semantic release automation

## [0.2.0] - 2025-01-10

### Added
- Initial release of erzencode
- AI-powered coding assistant CLI
- Support for multiple AI providers (Anthropic, OpenAI, Google, xAI, Mistral, etc.)
- Terminal UI with Ink
- Web UI with Monaco editor and xterm.js
- File system tools (read, write, edit, list, search)
- Shell command execution
- Git integration
- Session management
- Slash commands
- Custom themes
- Thinking mode support for capable models

[Unreleased]: https://github.com/ErzenXz/erzencode/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ErzenXz/erzencode/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ErzenXz/erzencode/releases/tag/v0.2.0
