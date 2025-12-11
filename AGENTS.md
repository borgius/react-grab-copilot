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
  "systemPrompt": "Optional custom system prompt to guide the assistant",
  "directMessage": false,
  "background": true,
  "options": {
    "model": "gpt-4o"
  }
}
```

**Options:**
- `directMessage` (boolean): When `true`, bypasses the `@react-grab` participant and sends directly to the LM API. Uses fire-and-forget pattern - responds immediately with status and done events.
- `background` (boolean): When `true` (default), runs silently. When `false`, opens VS Code chat panel. Only applies when `directMessage=true`.

Response: Server-Sent Events (SSE) stream

For direct message mode, response is:
```
event: status
data: started direct message <requestId>

event: done
data:
```

**GET** `http://localhost:6567/models`

Returns available Copilot models and their capabilities.

Response:
```json
{
  "models": [
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "vendor": "copilot",
      "family": "gpt-4o",
      "version": "2024-05-13",
      "maxInputTokens": 128000,
      "capabilities": {
        "supportsVision": true,
        "supportsTools": true
      }
    }
  ]
}
```

**POST** `http://localhost:6567/prompt`

Analyzes a user prompt and returns 3 improved variants optimized for the project context.

Request body:
```json
{
  "prompt": "Your prompt here",
  "content": "Optional content context",
  "systemPrompt": "Optional custom system prompt to guide prompt improvement",
  "options": {
    "model": "gpt-4o"
  }
}
```

Response:
```json
{
  "variants": [
    "First improved prompt variant",
    "Second improved prompt variant",
    "Third improved prompt variant"
  ]
}
```
