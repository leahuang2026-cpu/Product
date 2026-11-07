"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  AppState,
  emptyState,
  exportState,
  parseImport,
  STORAGE_KEY,
} from "@/lib/domain";
import { seedState } from "@/lib/seed";
type Store = {
  state: AppState;
  ready: boolean;
  error: string;
  update: (fn: (s: AppState) => AppState) => boolean;
  replace: (s: AppState) => boolean;
  clearError: () => void;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Hydrate only after the server-compatible first render; keep browser I/O outside render.
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const initial = saved ? parseImport(saved) : seedState();
        if (!saved) localStorage.setItem(STORAGE_KEY, exportState(initial));
        setState(initial);
      } catch {
        setError(
          "本地数据无法读取。为保护已有记录，已暂停保存；请先在数据设置中导出原始备份，再重置或导入有效数据。",
        );
        setBlocked(true);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        setState(e.newValue ? parseImport(e.newValue) : emptyState());
        setBlocked(false);
      } catch {
        setError("另一标签页写入了无法读取的数据，请备份后恢复。");
        setBlocked(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const replace = useCallback((next: AppState) => {
    try {
      localStorage.setItem(STORAGE_KEY, exportState(next));
      setState(next);
      setBlocked(false);
      setError("");
      return true;
    } catch {
      setError(
        "保存失败：浏览器存储不可用或空间已满。请导出备份，或减少附件大小后重试。当前输入仍保留。",
      );
      return false;
    }
  }, []);
  const update = (fn: (s: AppState) => AppState) => {
    if (blocked || !ready) {
      setError("当前数据尚不可写，请先到数据设置恢复。");
      return false;
    }
    try {
      // Read immediately before writing so ordinary edits in another tab are retained.
      const latest = localStorage.getItem(STORAGE_KEY);
      return replace(fn(latest ? parseImport(latest) : state));
    } catch {
      setError("更新未保存，请检查数据或到数据设置恢复备份。");
      return false;
    }
  };
  return (
    <Context.Provider
      value={{
        state,
        ready,
        error,
        update,
        replace,
        clearError: () => setError(""),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}
