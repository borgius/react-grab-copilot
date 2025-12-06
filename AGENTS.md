# AGENTS.md

This file provides guidance for AI agents working with this codebase.

## Project Overview

**React Grab Copilot** is a VS Code extension that exposes GitHub Copilot as an agent server. It starts a local HTTP server (default port 6567) that accepts POST requests and forwards them to the GitHub Copilot Chat API, streaming responses back via SSE.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: VS Code Extension API
- **Build Tool**: Vite
- **Test Framework**: Vitest
- **Linting/Formatting**: Biome
- **Package Manager**: pnpm
- **HTTP Server**: Hono with `@hono/node-server`

## Project Structure

```
src/
├── extension.ts          # VS Code extension entry point
├── participant/          # Chat participant implementation
├── server/               # HTTP server (Hono-based)
└── tools/                # VS Code language model tools
    ├── diagnostics/      # Error/diagnostic tools
    ├── edit/             # File editing tools
    ├── fs/               # File system tools
    ├── scm/              # Source control tools
    ├── search/           # Search tools
    ├── terminal/         # Terminal command tools
    └── util/             # Utility tools

test/                     # Test files (mirrors src/ structure)
```

## Common Commands

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm run build

# Watch mode for development
pnpm run watch

# Run linting
pnpm run lint

# Format code
pnpm run format

# Check and fix (lint + format)
pnpm run check
```

## Code Style Guidelines

- Use **Biome** for linting and formatting (configured in `biome.json`)
- Follow TypeScript strict mode conventions
- Prefer functional patterns where appropriate
- Keep tools modular and single-purpose

## Key Files

- `src/extension.ts` - Extension activation and lifecycle
- `src/server/server.ts` - HTTP server setup and routing
- `src/participant/participant.ts` - Chat participant handler
- `src/tools/tool.ts` - Base tool interface/utilities
- `src/tools/index.ts` - Tool exports and registration

## Testing

Tests are located in the `test/` directory and mirror the `src/` structure. Run tests with:

```bash
pnpm test
```

## Configuration

The extension exposes one configuration option:
- `reactGrabCopilot.port`: Port for the agent server (default: 6567)

## API Endpoint

**POST** `http://localhost:6567/agent`

Request body:
```json
{
  "prompt": "Your prompt here",
  "content": "Optional content context",
  "options": {
    "model": "gpt-4o"
  }
}
```

Response: Server-Sent Events (SSE) stream
