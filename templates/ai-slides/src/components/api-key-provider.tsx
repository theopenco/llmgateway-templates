"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
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

function getStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const storedKey = useSyncExternalStore(subscribe, getStoredKey, () => null);
  const [apiKey, setApiKey] = useState<string | null>(storedKey);
  const [open, setOpen] = useState(!storedKey);
  const [input, setInput] = useState("");

  // Hydration: SSR returns false, client returns true — no effect needed
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

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

  if (!isMounted) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        </div>
      );
    }

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