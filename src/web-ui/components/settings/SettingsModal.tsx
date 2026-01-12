import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Workflow, Key, Palette } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const {
    config,
    providers,
    models,
    loadModels,
    refreshProviders,
    setProvider,
    setModel,
    setThinkingLevel,
    setTemperature,
    setMaxTokens,
  } = useConfig();
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const handleProviderChange = async (value: string) => {
    if (config?.provider !== value) {
      await setProvider(value);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!config?.provider) return;
    void loadModels(config.provider);
  }, [config?.provider, loadModels, open]);

  const handleSaveApiKey = async () => {
    const provider = config?.provider;
    if (!provider) return;
    const trimmed = apiKey.trim();
    if (!trimmed) return;

    await fetch("/api/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: trimmed }),
    });
    await refreshProviders();
  };

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your AI coding experience
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="provider" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="provider">
              <Workflow className="mr-2 h-4 w-4" />
              Provider
            </TabsTrigger>
            <TabsTrigger value="keys">
              <Key className="mr-2 h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="mr-2 h-4 w-4" />
              Appearance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="provider" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider">AI Provider</Label>
              <Select value={config.provider} onValueChange={handleProviderChange}>
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{provider.name}</span>
                        {!provider.hasKey && (
                          <span className="text-xs text-muted-foreground">(no key)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={config.model} onValueChange={setModel}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.length > 0 ? (
                    models.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={config.model}>{config.model}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the AI model to use for code generation
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thinking">Thinking</Label>
              <Select
                value={config.thinkingLevel ?? "off"}
                onValueChange={(v) => setThinkingLevel(v as any)}
              >
                <SelectTrigger id="thinking">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={String(config.temperature ?? 0.7)}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min="1"
                  value={String(config.maxTokens ?? 16384)}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mode">Agent Mode</Label>
              <Select value={config.mode} disabled>
                <SelectTrigger id="mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent (full autonomy)</SelectItem>
                  <SelectItem value="ask">Ask (Q&A only)</SelectItem>
                  <SelectItem value="plan">Plan (planning mode)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="keys" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? "🙈" : "👁️"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                API keys are stored locally and never sent to our servers
              </p>
            </div>

            <Button onClick={handleSaveApiKey} className="w-full">
              Save API Key
            </Button>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-2">API Key Status</p>
              <div className="space-y-2">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{provider.name}</span>
                    <span
                      className={provider.hasKey ? "text-green-500" : "text-muted-foreground"}
                    >
                      {provider.hasKey ? "✓ Configured" : "Not set"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                <button className="rounded-md border border-border p-3 text-xs hover:bg-accent">
                  Dark
                </button>
                <button className="rounded-md border border-border p-3 text-xs hover:bg-accent">
                  Light
                </button>
                <button className="rounded-md border border-border p-3 text-xs hover:bg-accent">
                  System
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                {["#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f59e0b"].map(
                  (color) => (
                    <button
                      key={color}
                      className="h-8 w-8 rounded-full border-2 border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ),
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Font Size</Label>
              <Select defaultValue="13">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">Small (12px)</SelectItem>
                  <SelectItem value="13">Medium (13px)</SelectItem>
                  <SelectItem value="14">Large (14px)</SelectItem>
                  <SelectItem value="16">Extra Large (16px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
