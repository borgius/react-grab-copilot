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

Send a POST request to `http://localhost:6567/agent` with JSON body:

```json
{
  "prompt": "Explain this code",
  "content": "const x = 1;",
  "options": {
    "model": "gpt-4o"
  }
}
```

The response will be an SSE stream.
