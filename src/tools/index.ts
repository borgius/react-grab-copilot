import type { EventEmitter } from "events";
import { getErrorsTool } from "./diagnostics/getErrors";
import { applyPatchTool } from "./edit/applyPatch";
import { editFileTool } from "./edit/editFile";
import { replaceStringTool } from "./edit/replaceString";
import { createDirectoryTool } from "./fs/createDirectory";
import { createFileTool } from "./fs/createFile";
import { listDirTool } from "./fs/listDir";
import { readFileTool } from "./fs/readFile";
import { readProjectStructureTool } from "./fs/readProjectStructure";
import { scmChangesTool } from "./scm/scmChanges";
import { findFilesTool } from "./search/findFiles";
import { findTextTool } from "./search/findText";
import { searchWorkspaceSymbolsTool } from "./search/searchSymbols";
import { runTerminalCommandTool } from "./terminal/runCommand";
import type { Tool } from "./tool";
import { createGrabTaskCompletedTool } from "./util/taskCompleted";

export { Tool } from "./tool";

export const getTools = (eventEmitter: EventEmitter): Tool[] => [
  // FS
  readFileTool,
  createFileTool,
  createDirectoryTool,
  listDirTool,
  readProjectStructureTool,

  // Edit
  editFileTool,
  replaceStringTool,
  applyPatchTool,

  // Search
  findFilesTool,
  findTextTool,
  searchWorkspaceSymbolsTool,

  // Diagnostics
  getErrorsTool,

  // SCM
  scmChangesTool,

  // Terminal
  runTerminalCommandTool,

  // Util
  createGrabTaskCompletedTool(eventEmitter),
];
