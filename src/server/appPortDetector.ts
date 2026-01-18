import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";

const execAsync = promisify(exec);

export interface DetectedAppPort {
  port: number;
  source: "config" | "process" | "terminal";
  confidence: "high" | "medium" | "low";
  name?: string;
  configFile?: string;
}

interface PortDetectionResult {
  ports: DetectedAppPort[];
  primaryPort: number | null;
}

/**
 * Detect app ports from various sources:
 * 1. Config files (vite.config.ts, webpack.config.js, etc.)
 * 2. Running processes started from VS Code terminals
 * 3. Common dev server ports
 */
export async function detectAppPorts(): Promise<PortDetectionResult> {
  const ports: DetectedAppPort[] = [];

  // Get workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return { ports, primaryPort: null };
  }

  // Detect ports from config files
  for (const folder of workspaceFolders) {
    const configPorts = await detectPortsFromConfigFiles(folder.uri.fsPath);
    ports.push(...configPorts);
  }

  // Detect ports from running processes
  const processPorts = await detectPortsFromProcesses();
  ports.push(...processPorts);

  // Deduplicate and sort by confidence
  const uniquePorts = deduplicatePorts(ports);
  const primaryPort = uniquePorts.length > 0 ? uniquePorts[0].port : null;

  return { ports: uniquePorts, primaryPort };
}

/**
 * Detect ports from config files in the workspace
 */
async function detectPortsFromConfigFiles(
  workspacePath: string,
): Promise<DetectedAppPort[]> {
  const ports: DetectedAppPort[] = [];

  // Config file patterns and their port extraction logic
  const configPatterns = [
    {
      files: ["vite.config.ts", "vite.config.js", "vite.config.mjs"],
      regex: /port\s*:\s*(\d+)/,
      name: "Vite",
    },
    {
      files: ["webpack.config.js", "webpack.config.ts"],
      regex: /port\s*:\s*(\d+)/,
      name: "Webpack",
    },
    {
      files: ["next.config.js", "next.config.mjs", "next.config.ts"],
      regex: /port\s*:\s*(\d+)/,
      name: "Next.js",
      defaultPort: 3000,
    },
    {
      files: ["angular.json"],
      regex: /"port"\s*:\s*(\d+)/,
      name: "Angular",
      defaultPort: 4200,
    },
    {
      files: ["vue.config.js"],
      regex: /port\s*:\s*(\d+)/,
      name: "Vue CLI",
      defaultPort: 8080,
    },
    {
      files: ["package.json"],
      regex: /"dev":\s*".*--port\s+(\d+).*"/,
      name: "npm script",
    },
    {
      files: [".env", ".env.local", ".env.development"],
      regex: /(?:PORT|VITE_PORT|DEV_PORT)\s*=\s*(\d+)/,
      name: "Environment",
    },
  ];

  for (const pattern of configPatterns) {
    for (const fileName of pattern.files) {
      const filePath = path.join(workspacePath, fileName);
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          const match = content.match(pattern.regex);
          if (match?.[1]) {
            const port = Number.parseInt(match[1], 10);
            if (isValidPort(port)) {
              ports.push({
                port,
                source: "config",
                confidence: "high",
                name: pattern.name,
                configFile: fileName,
              });
            }
          } else if (pattern.defaultPort) {
            // If config exists but no port specified, use default
            ports.push({
              port: pattern.defaultPort,
              source: "config",
              confidence: "medium",
              name: `${pattern.name} (default)`,
              configFile: fileName,
            });
          }
        }
      } catch {
        // Ignore file read errors
      }
    }
  }

  // Check for package.json scripts that indicate common ports
  try {
    const packageJsonPath = path.join(workspacePath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const scripts = packageJson.scripts || {};

      // Check for common dev server scripts
      const devScripts = ["dev", "start", "serve", "develop"];
      for (const script of devScripts) {
        if (scripts[script]) {
          const scriptContent = scripts[script];
          // Extract port from script
          const portMatch = scriptContent.match(/--port[=\s]+(\d+)/);
          if (portMatch?.[1]) {
            const port = Number.parseInt(portMatch[1], 10);
            if (isValidPort(port)) {
              ports.push({
                port,
                source: "config",
                confidence: "high",
                name: `npm ${script}`,
                configFile: "package.json",
              });
            }
          }

          // Detect framework and add default port if not already found
          if (
            scriptContent.includes("vite") &&
            !ports.some((p) => p.name?.includes("Vite"))
          ) {
            ports.push({
              port: 5173,
              source: "config",
              confidence: "low",
              name: "Vite (default)",
              configFile: "package.json",
            });
          } else if (
            scriptContent.includes("next") &&
            !ports.some((p) => p.name?.includes("Next"))
          ) {
            ports.push({
              port: 3000,
              source: "config",
              confidence: "low",
              name: "Next.js (default)",
              configFile: "package.json",
            });
          } else if (
            scriptContent.includes("react-scripts") &&
            !ports.some((p) => p.name?.includes("CRA"))
          ) {
            ports.push({
              port: 3000,
              source: "config",
              confidence: "low",
              name: "Create React App (default)",
              configFile: "package.json",
            });
          }
        }
      }
    }
  } catch {
    // Ignore package.json parse errors
  }

  return ports;
}

/**
 * Detect ports from running processes
 * This is cross-platform and looks for common dev server processes
 */
async function detectPortsFromProcesses(): Promise<DetectedAppPort[]> {
  const ports: DetectedAppPort[] = [];

  try {
    const platform = process.platform;
    let command: string;

    if (platform === "win32") {
      // Windows: Use netstat to find listening ports
      command = "netstat -ano | findstr LISTENING";
    } else {
      // macOS and Linux: Use lsof to find listening ports
      command = "lsof -i -P -n | grep LISTEN";
    }

    const { stdout } = await execAsync(command, { timeout: 5000 });
    const lines = stdout.split("\n");

    // Common dev server ports to look for
    const devPorts = [
      3000, 3001, 3002, 3003, 4000, 4200, 5000, 5173, 5174, 5175, 8000, 8080,
      8081, 8888, 9000,
    ];

    for (const line of lines) {
      for (const devPort of devPorts) {
        if (line.includes(`:${devPort}`)) {
          // Check if this port is likely a dev server by examining process name
          const isDevServer =
            line.includes("node") ||
            line.includes("npm") ||
            line.includes("pnpm") ||
            line.includes("yarn") ||
            line.includes("python") ||
            line.includes("ruby") ||
            line.includes("php");

          if (isDevServer) {
            ports.push({
              port: devPort,
              source: "process",
              confidence: "medium",
              name: "Running dev server",
            });
          }
        }
      }
    }
  } catch {
    // Process detection failed, continue without it
  }

  return ports;
}

/**
 * Check if port number is valid
 */
function isValidPort(port: number): boolean {
  return port >= 1 && port <= 65535;
}

/**
 * Deduplicate ports and sort by confidence
 */
function deduplicatePorts(ports: DetectedAppPort[]): DetectedAppPort[] {
  const portMap = new Map<number, DetectedAppPort>();

  // Confidence priority: high > medium > low
  const confidenceOrder = { high: 3, medium: 2, low: 1 };

  for (const port of ports) {
    const existing = portMap.get(port.port);
    if (
      !existing ||
      confidenceOrder[port.confidence] > confidenceOrder[existing.confidence]
    ) {
      portMap.set(port.port, port);
    }
  }

  return Array.from(portMap.values()).sort(
    (a, b) => confidenceOrder[b.confidence] - confidenceOrder[a.confidence],
  );
}

/**
 * Check if a specific port is currently in use
 */
export async function isPortInUse(port: number): Promise<boolean> {
  try {
    const platform = process.platform;
    let command: string;

    if (platform === "win32") {
      command = `netstat -ano | findstr :${port}`;
    } else {
      command = `lsof -i :${port} -P -n | grep LISTEN`;
    }

    const { stdout } = await execAsync(command, { timeout: 2000 });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the workspace name for identification
 */
export function getWorkspaceName(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return "Unknown Workspace";
  }

  // Return the name of the first workspace folder
  return workspaceFolders[0].name;
}

/**
 * Get workspace folder paths
 */
export function getWorkspacePaths(): string[] {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return [];
  }
  return workspaceFolders.map((f) => f.uri.fsPath);
}
