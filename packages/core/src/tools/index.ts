/**
 * Tools Module Entry Point
 * Re-exports from tools-standalone for cleaner imports
 */

export {
  // Todo management
  type TodoItem,
  getTodos,
  setTodoUpdateCallback,

  // Bash approval
  setBashYoloMode,
  addBashAllowPrefix,
  removeBashAllowPrefix,
  approveBashCommandOnce,
  cancelBashApproval,
  getBashApprovalStatus,
  getPendingBashApprovals,

  // Question/User input
  type QuestionOption,
  type QuestionRequest,
  type QuestionResponse,
  getPendingQuestions,
  answerQuestion,
  cancelQuestion,

  // Workspace
  setWorkspaceRoot,

  // Tools
  getAllTools,

  // Individual tool exports
  readTool,
  writeTool,
  editTool,
  globTool,
  grepTool,
  bashTool,
  listTool,
  taskTool,
  todoWriteTool,
  todoReadTool,
  questionTool,
  webFetchTool,
  exaWebSearchTool,
  exaCodeSearchTool,
  semanticSearchTool,
  indexStatusTool,

  // Legacy aliases
  readFileTool,
  writeFileTool,
  editFileTool,
  executeCommandTool,
  searchFilesTool,
  fileTreeTool,
  todoTool,

  // Subagent management
  setSubagentExecutor,
  setSubagentTool,
  getSubagentTool,

  // Indexer utilities
  invalidateIndexCache,
  awaitAutoIndexIdle,
  isSemanticSearchAvailable,
} from "./tools-standalone.js";
