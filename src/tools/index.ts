import { Tool } from "./tool";
import { readFileTool } from "./fs/readFile";
import { createFileTool } from "./fs/createFile";
import { createDirectoryTool } from "./fs/createDirectory";
import { listDirTool } from "./fs/listDir";
import { readProjectStructureTool } from "./fs/readProjectStructure";
import { editFileTool } from "./edit/editFile";
import { replaceStringTool } from "./edit/replaceString";
import { findFilesTool } from "./search/findFiles";
import { findTextTool } from "./search/findText";
import { searchWorkspaceSymbolsTool } from "./search/searchSymbols";
import { runTerminalCommandTool } from "./terminal/runCommand";
import { getErrorsTool } from "./diagnostics/getErrors";
import { scmChangesTool } from "./scm/scmChanges";
import { createGrabTaskCompletedTool } from "./util/taskCompleted";
import { EventEmitter } from "events";

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
