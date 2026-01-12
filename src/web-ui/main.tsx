import React from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import "@xterm/xterm/css/xterm.css";
import { App } from "./App";
import { ConfigProvider } from "./hooks/useConfig";

const el = document.getElementById("root");
if (!el) {
  throw new Error("Missing #root element");
}

createRoot(el).render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
