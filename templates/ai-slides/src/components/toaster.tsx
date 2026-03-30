"use client";

import { X, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useToasts, dismissToast, type Toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const icons: Record<Toast["type"], React.ElementType> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const styles: Record<Toast["type"], string> = {
  error: "border-red-500/30 bg-red-950/80 text-red-200",
  success: "border-green-500/30 bg-green-950/80 text-green-200",
  info: "border-blue-500/30 bg-blue-950/80 text-blue-200",
};

export function Toaster() {
  const { toasts } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5 fade-in duration-200",
              styles[toast.type]
            )}
          >
            <Icon className="size-4 shrink-0 mt-0.5" />
            <span className="flex-1 text-xs leading-relaxed">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded p-0.5 hover:bg-white/10 transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
