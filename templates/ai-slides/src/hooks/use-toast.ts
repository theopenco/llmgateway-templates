"use client";

import { useCallback, useSyncExternalStore } from "react";
import { nanoid } from "nanoid";

export type Toast = {
  id: string;
  message: string;
  type: "error" | "success" | "info";
};

const MAX_TOASTS = 5;
const TOAST_DURATION = 5000;

let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return toasts;
}

export function addToast(message: string, type: Toast["type"] = "error") {
  const id = nanoid(8);
  toasts = [{ id, message, type }, ...toasts].slice(0, MAX_TOASTS);
  emit();
  setTimeout(() => {
    dismissToast(id);
  }, TOAST_DURATION);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toast = useCallback(
    (message: string, type: Toast["type"] = "error") => addToast(message, type),
    []
  );

  return { toasts: current, toast, dismiss: dismissToast };
}
