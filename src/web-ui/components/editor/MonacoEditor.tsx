import { useEffect, useRef, useState } from "react";
import Editor, { Monaco } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

import { cn } from "@/lib/utils";

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string | undefined) => void;
  language?: string;
  path?: string;
  readOnly?: boolean;
  className?: string;
}

export function MonacoEditor({
  value,
  onChange,
  language = "typescript",
  path,
  readOnly = false,
  className,
}: MonacoEditorProps) {
  const [isEditorReady, setIsEditorReady] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    setIsEditorReady(true);

    // Configure theme
    monaco.editor.defineTheme("erzencode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0a0a0f",
        "editor.foreground": "#e4e4e7",
        "editor.lineHighlightBackground": "#18181b",
        "editorLineNumber.foreground": "#52525b",
        "editor.selectionBackground": "#8b5cf640",
        "editor.inactiveSelectionBackground": "#8b5cf620",
        "editorCursor.foreground": "#8b5cf6",
      },
    });
    monaco.editor.setTheme("erzencode-dark");

    // Configure options
    editor.updateOptions({
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      lineNumbers: "on",
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      readOnly,
      automaticLayout: true,
    });
  };

  // Detect language from file extension
  const getLanguageFromPath = (filePath?: string): string => {
    if (!filePath) return language;
    const ext = filePath.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      css: "css",
      scss: "scss",
      html: "html",
      json: "json",
      md: "markdown",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      cpp: "cpp",
      c: "c",
    };
    return langMap[ext || ""] || language;
  };

  return (
    <div className={cn("h-full w-full", className)}>
      <Editor
        height="100%"
        language={getLanguageFromPath(path)}
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme="erzencode-dark"
        options={{
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          lineNumbers: "on",
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          readOnly,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
        }}
        loading={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
