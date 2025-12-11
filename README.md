# React Grab Copilot

VS Code extension that exposes GitHub Copilot as an agent server.

## Features

- Starts a local HTTP server (default port 6567).
- Accepts POST requests to `/agent`.
- Forwards requests to GitHub Copilot Chat API.
- Streams responses back via SSE.

## Configuration

- `reactGrabCopilot.port`: Port to listen on (default: 6567).

## Usage

### `/agent` Endpoint

Send a POST request to `http://localhost:6567/agent` with JSON body:

```json
{
  "prompt": "Explain this code",
  "content": "const x = 1;",
  "systemPrompt": "You are a TypeScript expert. Always provide type-safe solutions.",
  "options": {
    "model": "gpt-4o"
  }
}
```

The response will be an SSE stream.

### `/models` Endpoint

Get available Copilot models and their capabilities:

```bash
curl http://localhost:6567/models
```

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

### `/prompt` Endpoint

Send a POST request to `http://localhost:6567/prompt` to analyze a prompt and get 3 improved variants:

```json
{
  "prompt": "fix this bug",
  "content": "const x = 1;",
  "systemPrompt": "You are a TypeScript expert. Always provide type-safe solutions.",
  "options": {
    "model": "gpt-4o"
  }
}
```

Response:

```json
{
  "variants": [
    "Fix the type error in the variable declaration and ensure proper type inference",
    "Analyze and fix the bug in this code, ensuring type safety and handling edge cases",
    "Debug and correct the issue in this code following TypeScript best practices"
  ]
}
```
