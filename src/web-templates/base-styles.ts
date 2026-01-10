export const baseStyles = `
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f9fafb;
    --bg-tertiary: #f3f4f6;
    --border: #e5e7eb;
    --border-subtle: #f3f4f6;
    --text-primary: #111827;
    --text-secondary: #6b7280;
    --text-muted: #9ca3af;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --accent-light: #eff6ff;
    --success: #059669;
    --warning: #d97706;
    --error: #dc2626;
    --code-bg: #f8fafc;
  }
  [data-theme="dark"] {
    --bg-primary: #0a0a0a;
    --bg-secondary: #171717;
    --bg-tertiary: #262626;
    --border: #404040;
    --border-subtle: #262626;
    --text-primary: #fafafa;
    --text-secondary: #a3a3a3;
    --text-muted: #737373;
    --accent: #3b82f6;
    --accent-hover: #2563eb;
    --accent-light: #1e3a5f;
    --success: #22c55e;
    --warning: #f59e0b;
    --error: #ef4444;
    --code-bg: #1c1c1c;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { 
    height: 100%; 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.5;
    transition: background 0.2s, color 0.2s;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
  button { 
    cursor: pointer; 
    font-family: inherit;
    border: none;
    background: none;
    color: inherit;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: 8px;
    padding: 10px 12px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input:focus, textarea:focus, select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-light);
  }
  select { cursor: pointer; }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 13px;
    transition: all 0.15s;
  }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
  .btn-secondary { background: var(--bg-tertiary); border: 1px solid var(--border); }
  .btn-secondary:hover:not(:disabled) { background: var(--border); }
  .btn-ghost { background: transparent; }
  .btn-ghost:hover:not(:disabled) { background: var(--bg-tertiary); }
  .btn-sm { padding: 6px 10px; font-size: 12px; }
  .btn-icon { width: 32px; height: 32px; padding: 0; border-radius: 6px; }
  code, pre { font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Fira Code', monospace; }
  .fade-in { animation: fadeIn 0.15s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
  .pulse { animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes typingBounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-4px); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { animation: spin 1s linear infinite; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
`;
