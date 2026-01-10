import { useState, useEffect } from "react";
import {
  RefreshCw,
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  RotateCw,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DevicePreset = "mobile" | "tablet" | "desktop" | "custom";

interface PreviewPanelProps {
  port?: number;
  className?: string;
}

const DEVICE_PRESETS: Record<
  DevicePreset,
  { width: string; height: string; icon: React.ReactNode }
> = {
  mobile: { width: "375px", height: "667px", icon: <Smartphone className="h-4 w-4" /> },
  tablet: { width: "768px", height: "1024px", icon: <Tablet className="h-4 w-4" /> },
  desktop: { width: "100%", height: "100%", icon: <Monitor className="h-4 w-4" /> },
  custom: { width: "100%", height: "100%", icon: <Globe className="h-4 w-4" /> },
};

export function PreviewPanel({ port = 3000, className }: PreviewPanelProps) {
  const [device, setDevice] = useState<DevicePreset>("desktop");
  const [url, setUrl] = useState(`http://localhost:${port}`);
  const [loading, setLoading] = useState(false);
  const [ports, setPorts] = useState<number[]>([3000, 3001, 5173, 8080]);

  const preset = DEVICE_PRESETS[device];

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const handleOpenExternal = () => {
    window.open(url, "_blank");
  };

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Preview Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {/* Device Selector */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5">
          {(["mobile", "tablet", "desktop"] as DevicePreset[]).map((d) => (
            <button
              key={d}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                device === d
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50"
              )}
              onClick={() => setDevice(d)}
              title={d}
            >
              {DEVICE_PRESETS[d].icon}
            </button>
          ))}
        </div>

        {/* Port Selector */}
        <Select
          value={port.toString()}
          onValueChange={(v) => {
            const newPort = parseInt(v);
            setUrl(`http://localhost:${newPort}`);
          }}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ports.map((p) => (
              <SelectItem key={p} value={p.toString()}>
                Port {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* Actions */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleOpenExternal}
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto bg-muted p-4">
        <div
          className="mx-auto bg-white shadow-lg transition-all duration-300"
          style={{
            width: preset.width,
            height: preset.height,
            maxWidth: device === "desktop" ? "100%" : preset.width,
          }}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <RotateCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <iframe
              src={url}
              className="h-full w-full border-0"
              title="Preview"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Editor + Preview Split Panel
interface EditorPreviewSplitProps {
  filePath?: string;
  fileContent?: string;
  onFileChange?: (content: string) => void;
  previewPort?: number;
  className?: string;
}

export function EditorPreviewSplit({
  filePath,
  fileContent = "",
  onFileChange,
  previewPort = 3000,
  className,
}: EditorPreviewSplitProps) {
  const [view, setView] = useState<"editor" | "preview" | "split">("split");
  const [localContent, setLocalContent] = useState(fileContent);

  useEffect(() => {
    setLocalContent(fileContent);
  }, [fileContent]);

  const handleChange = (value: string | undefined) => {
    const newContent = value || "";
    setLocalContent(newContent);
    onFileChange?.(newContent);
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* View Toggle */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5">
          {[
            { value: "editor", label: "Code" },
            { value: "split", label: "Split" },
            { value: "preview", label: "Preview" },
          ].map((v) => (
            <button
              key={v.value}
              className={cn(
                "rounded px-3 py-1 text-xs transition-colors",
                view === v.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50"
              )}
              onClick={() => setView(v.value as typeof view)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === "editor" && (
          <div className="h-full">
            <textarea
              className="h-full w-full bg-background p-4 font-mono text-sm text-foreground resize-none focus:outline-none"
              value={localContent}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="File content will appear here..."
            />
          </div>
        )}

        {view === "preview" && <PreviewPanel port={previewPort} />}

        {view === "split" && (
          <div className="grid h-full grid-cols-2">
            <div className="border-r border-border">
              <textarea
                className="h-full w-full bg-background p-4 font-mono text-sm text-foreground resize-none focus:outline-none"
                value={localContent}
                onChange={(e) => handleChange(e.target.value)}
              />
            </div>
            <PreviewPanel port={previewPort} />
          </div>
        )}
      </div>
    </div>
  );
}
