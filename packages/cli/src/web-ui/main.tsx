/**
 * Web UI Entry Point
 * React-based web interface for ErzenCode
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>ErzenCode</h1>
        <p>AI-powered coding assistant</p>
      </header>
      <main className="app-main">
        <p>Web UI is under development. Use the terminal UI for now:</p>
        <code>erzencode</code>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
