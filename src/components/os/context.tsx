"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { request } from "@/lib/os/client";
import type { Domain } from "@/lib/os/model";
type Session = { configured: boolean; authenticated: boolean; email?: string };
type Context = {
  domains: Domain[];
  setDomains: (d: Domain[]) => void;
  composer: boolean;
  setComposer: (v: boolean) => void;
  session: Session | null;
  sessionError: string;
  refreshSession: () => Promise<void>;
  revision: number;
  reload: () => void;
  dirty: boolean;
  setDirty: (v: boolean) => void;
  navigate: (action: () => void) => void;
};
const Ctx = createContext<Context | null>(null);
export function OSProvider({ children }: { children: ReactNode }) {
  const [domains, setDomains] = useState<Domain[]>([]),
    [composer, setComposer] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [sessionError, setSessionError] = useState(""),
    [revision, setRevision] = useState(0),
    [dirty, setDirty] = useState(false);
  const refreshSession = useCallback(async () => {
    try {
      setSession(await request<Session>("/api/auth/session"));
      setSessionError("");
      setRevision((v) => v + 1);
    } catch (e) {
      setSession(null);
      setSessionError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void refreshSession());
  }, [refreshSession]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  const navigate = (action: () => void) => {
    if (
      !dirty ||
      window.confirm("有尚未保存的内容。确定放弃输入并离开？取消可继续编辑。")
    ) {
      setDirty(false);
      action();
    }
  };
  return (
    <Ctx.Provider
      value={{
        domains,
        setDomains,
        composer,
        setComposer,
        session,
        sessionError,
        refreshSession,
        revision,
        reload,
        dirty,
        setDirty,
        navigate,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useOS() {
  const value = useContext(Ctx);
  if (!value) throw new Error("OSProvider missing");
  return value;
}
export function useData<T>(path: string) {
  const { revision, session } = useOS();
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    queueMicrotask(() => {
      if (live) {
        setLoading(true);
        setError("");
        setData(null);
      }
    });
    request<T>(path, { signal: controller.signal })
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [path, revision, attempt, session?.authenticated]);
  return {
    data,
    setData,
    error,
    loading,
    retry: () => setAttempt((v) => v + 1),
  };
}
