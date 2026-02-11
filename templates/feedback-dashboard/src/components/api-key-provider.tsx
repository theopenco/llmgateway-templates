"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "llmgateway-api-key";

type ApiKeyContextValue = {
  apiKey: string | null;
  setOpen: (open: boolean) => void;
};

const ApiKeyContext = createContext<ApiKeyContextValue>({
  apiKey: null,
  setOpen: () => {},
});

export function useApiKey() {
  return useContext(ApiKeyContext);
}

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
    } else {
      setOpen(true);
    }
    setMounted(true);
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setApiKey(trimmed);
    setOpen(false);
  }, [input]);

  const handleSkip = useCallback(() => {
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value && !apiKey) {
        // Allow closing even without a key (env-var deployments)
        setOpen(false);
        return;
      }
      setOpen(value);
      if (value) {
        setInput(apiKey ?? "");
      }
    },
    [apiKey]
  );

  if (!mounted) return null;

  return (
    <ApiKeyContext.Provider value={{ apiKey, setOpen }}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={!!apiKey}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5" />
              LLM Gateway API Key
            </DialogTitle>
            <DialogDescription>
              Enter your API key to use this demo. Your key is stored locally in
              your browser and sent as a request header.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="sk-..."
              className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Don&apos;t have a key?{" "}
              <a
                href="https://llmgateway.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Get one at llmgateway.io
              </a>
            </p>
          </div>
          <DialogFooter>
            {!apiKey && (
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
            )}
            <Button onClick={handleSave} disabled={!input.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ApiKeyContext.Provider>
  );
}
