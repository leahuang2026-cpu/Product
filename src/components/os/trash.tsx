"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { request } from "@/lib/os/client";
import type { TrashItem } from "@/lib/os/model";
import { useData, useOS } from "./context";
import { Empty, Notice, dateLabel } from "./common";

export function TrashLink() {
  const router = useRouter();
  const { navigate } = useOS();
  return (
    <Link
      className="button quiet"
      href="/settings#trash"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(() => router.push("/settings#trash"));
      }}
    >
      查看回收站
    </Link>
  );
}
export function TrashAction({
  id,
  kind,
  version,
  restore = false,
  disabled = false,
  onDone,
}: {
  id: string;
  kind: TrashItem["kind"];
  version: number;
  restore?: boolean;
  disabled?: boolean;
  onDone?: () => void;
}) {
  const { reload } = useOS();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{ body: string; key: string } | null>(null);
  async function act() {
    if (busy || disabled) return;
    if (
      !window.confirm(
        restore
          ? "恢复这项内容？原有领域、灵感标记及关联会保留。"
          : "将此内容移入回收站？原文和附件会保留，可在设置中恢复，不会永久删除。",
      )
    )
      return;
    const body = JSON.stringify({ id, kind, version, deleted: !restore });
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await request("/api/trash", {
        method: "POST",
        headers: { "Idempotency-Key": pending.current.key },
        body,
      });
      pending.current = null;
      reload();
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="button quiet"
        disabled={disabled || busy}
        onClick={() => void act()}
      >
        {busy ? "处理中…" : restore ? "恢复" : "移入回收站"}
      </button>
      {error && <Notice error={error} />}
    </>
  );
}
export function TrashPanel() {
  const { data, loading, error, retry } = useData<TrashItem[]>("/api/trash");
  const [message, setMessage] = useState("");
  return (
    <section className="panel" id="trash">
      <h2>回收站</h2>
      <p>
        移除的记录、方向和复盘保留在这里，可随时恢复。不会自动清理，也不提供永久删除。
      </p>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">正在读取回收站…</p>
      ) : error ? (
        <Notice error={error} onRetry={retry} />
      ) : !data?.length ? (
        <Empty title="回收站是空的" />
      ) : (
        <div className="entries">
          {data.map((item) => (
            <article className="entry-card" key={`${item.kind}-${item.id}`}>
              <small>
                {item.kind === "record"
                  ? "原始记录"
                  : item.kind === "direction"
                    ? "未来方向"
                    : "复盘"}{" "}
                · {dateLabel(item.deletedAt)} 移入
              </small>
              <h3>{item.title}</h3>
              <TrashAction
                {...item}
                restore
                onDone={() =>
                  setMessage("已恢复。可回到原模块查看，原有内容和关联保留。")
                }
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
