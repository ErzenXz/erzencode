/**
 * Conventional Commits Configuration
 *
 * Commit message format: <type>(<scope>): <description>
 *
 * Types:
 * - feat: A new feature
 * - fix: A bug fix
 * - docs: Documentation changes
 * - style: Code style changes (formatting, etc.)
 * - refactor: Code refactoring
 * - perf: Performance improvements
 * - test: Adding or updating tests
 * - build: Build system changes
 * - ci: CI/CD changes
 * - chore: Other changes
 * - revert: Revert a previous commit
 *
 * Examples:
 * - feat(cli): add support for custom themes
 * - fix(web-ui): resolve memory leak in terminal component
 * - docs(readme): update installation instructions
 * - test(ai-agent): add unit tests for streaming responses
 */

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
  },
};
