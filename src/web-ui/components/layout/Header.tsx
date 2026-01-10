import { Settings, Workflow, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfig } from "@/hooks/useConfig";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onOpenSettings?: () => void;
  className?: string;
}

export function Header({ onOpenSettings, className }: HeaderProps) {
  const { config, providers, loadModels, setProvider, setModel } = useConfig();

  const handleProviderChange = async (value: string) => {
    await setProvider(value);
    await loadModels(value);
  };

  const handleModelChange = async (value: string) => {
    await setModel(value);
  };

  if (!config) return null;

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border bg-background/80 px-4 py-2 backdrop-blur-sm",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500">
          <Code2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">erzencode</h1>
          <p className="text-xs text-muted-foreground">
            {config.workspaceRoot.replace(/^\/Users\/[^\/]+/, "~")}
          </p>
        </div>
      </div>

      {/* Provider & Model Selection */}
      <div className="flex items-center gap-2">
        {/* Provider Selector */}
        <Select value={config.provider} onValueChange={handleProviderChange}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id} disabled={!provider.hasKey}>
                <div className="flex items-center gap-2">
                  <Workflow className="h-3 w-3" />
                  <span>{provider.name}</span>
                  {!provider.hasKey && <span className="text-xs text-muted-foreground">(no key)</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Model Selector */}
        <Select value={config.model} onValueChange={handleModelChange}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            {/* Models loaded by provider - will be populated dynamically */}
            <SelectItem value={config.model}>{config.model}</SelectItem>
          </SelectContent>
        </Select>

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSettings}
          className="h-8 w-8"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
