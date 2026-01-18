# Change Log

## Unreleased

### Added
- Comprehensive logging system with configurable log levels (DEBUG, INFO, WARN, ERROR)
- Output channel now opens automatically on extension activation
- Detailed logging for all lifecycle events (activation, server start/stop, HTTP endpoints)
- Per-request tracking with unique request IDs in logs

### Changed
- Improved error handling and logging throughout the extension
- Console logs replaced with structured logger for better diagnostics

## 0.0.2

### Added
- New `/prompt` endpoint that analyzes user prompts and returns 3 improved variants optimized for the project context
- Example documentation for prompt improvement API usage

## 0.0.1

- Initial release
