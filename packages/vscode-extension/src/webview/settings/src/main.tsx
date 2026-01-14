/**
 * Main entry point for ErzenCode Settings React app
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Initialize VSCode API
declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

// Make vscode API available globally
(window as any).vscode = vscode;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
