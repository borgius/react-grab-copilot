# React Grab Copilot

VS Code extension that exposes GitHub Copilot as an agent server.

## Features

- Starts a local HTTP server (default port 6567).
- Accepts POST requests to `/agent`.
- Forwards requests to GitHub Copilot Chat API.
- Streams responses back via SSE.

## Configuration

- `reactGrabCopilot.port`: Port to listen on (default: 6567).
- `reactGrabCopilot.systemPrompt`: Custom system prompt for the agent (default: empty).
- `reactGrabCopilot.useAgentsMd`: Include AGENTS.md from workspace root in the system prompt context (default: true).
- `reactGrabCopilot.allowMcp`: Allow the agent to use MCP servers configured in VS Code (default: false).
- `reactGrabCopilot.sendScreenshotToLLM`: Send screenshots to the LLM for visual context (default: true).
- `reactGrabCopilot.logLevel`: Log level for the extension output (default: INFO).

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

#### Direct Message Mode

Set `directMessage: true` to bypass the `@react-grab` participant and send messages directly to the language model. This uses a fire-and-forget pattern - the server responds immediately with status and done events, and the agent continues working in the background.

```json
{
  "prompt": "Refactor this code",
  "content": "const x = 1;",
  "systemPrompt": "You are a TypeScript expert.",
  "directMessage": true,
  "background": true,
  "options": {
    "model": "gpt-4o"
  }
}
```

**Options:**
- `directMessage`: When `true`, sends directly to the LM API without using the `@react-grab` chat participant. Includes all system prompts, source context, and tools.
- `background`: When `true` (default), runs silently without opening the VS Code chat panel. When `false`, opens the chat panel to show progress.

**Response for direct mode:**
```
event: status
data: started direct message <requestId>

event: done
data:
```

The agent will continue working asynchronously. All system prompts, AGENTS.md content, source context enrichment, and tools are available in direct mode.

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
