/**
 * Message protocol for webview communication
 */

export interface WebviewMessage {
  type:
    | "sendMessage"
    | "fileOperation"
    | "commandExecution"
    | "configUpdate"
    | "openSettings"
    | "searchFiles"
    | "ready"
    | "getProviders"
    | "getModels"
    | "preloadModels";
  data: unknown;
}

export interface ExtensionMessage {
  type:
    | "streamEvent"
    | "fileTreeUpdate"
    | "error"
    | "configUpdate"
    | "searchResults"
    | "providers"
    | "models"
    | "modelsPreloaded";
  data: unknown;
}

export interface StreamEvent {
  type: "text-delta" | "tool-call" | "tool-result" | "finish" | "error";
  data: unknown;
}

export interface SendMessageData {
  content: string;
}

export interface ReadyData {
  sessionId?: string;
}
