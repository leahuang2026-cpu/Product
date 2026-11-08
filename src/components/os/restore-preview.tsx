"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Snapshot } from "@/lib/backup/format";
import { LIMITS } from "@/lib/backup/format";
import type { PreviewResult, PreviewStatus } from "@/lib/backup/preview";
const labels: Record<PreviewStatus, string> = {
  new: "待新增",
  same: "相同，拟跳过",
  conflict: "冲突",
  unsupported: "不支持",
};
const kinds = {
  record: "记录",
  attachment: "原件",
  focus: "关注",
  direction: "方向",
  reflection: "复盘",
};
export function RestorePreview({ snapshot }: { snapshot: Snapshot }) {
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null),
    [error, setError] = useState("");
  const [message, setMessage] = useState(""),
    [filter, setFilter] = useState<PreviewStatus | "all">("all");
  const [visible, setVisible] = useState(20);
  const [showPayload, setShowPayload] = useState(false);
  const payloadText = useMemo(
    () => (showPayload ? JSON.stringify(snapshot, null, 2) : ""),
    [showPayload, snapshot],
  );
  const pending = useRef<AbortController | null>(null),
    button = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  const titles = useMemo(
    () =>
      new Map([
        ...snapshot.records.map(
          (r) =>
            [
              `record:${r.id}`,
              r.originalText.trim().slice(0, 60) || "无正文记录",
            ] as const,
        ),
        ...snapshot.entries.map(
          (e) => [`${e.kind}:${e.id}`, e.title || e.body.slice(0, 60)] as const,
        ),
        ...snapshot.attachments.map(
          (a) => [`attachment:${a.id}`, a.name] as const,
        ),
      ]),
    [snapshot],
  );
  async function preview() {
    if (!consent || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setResult(null);
    setError("");
    setMessage("正在只读对比本人云端档案…");
    const timer = setTimeout(() => controller.abort(), LIMITS.timeout);
    try {
      const response = await fetch("/api/backups/restore/preview", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatVersion: 1, snapshot }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body?.error?.message || "云端对比未完成，请重试。");
      if (pending.current !== controller) return;
      setResult(body.data);
      setFilter("all");
      setVisible(20);
      setMessage("只读对比完成，没有恢复或修改任何内容。");
    } catch (e) {
      if (pending.current === controller) {
        setMessage("");
        setError(
          controller.signal.aborted
            ? "预检已取消或超时，没有写入数据。可以重试。"
            : e instanceof Error
              ? e.message
              : "预检未完成，请重试。",
        );
      }
    } finally {
      clearTimeout(timer);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function cancel() {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setResult(null);
    setError("");
    setConsent(false);
    setMessage("已取消或清除预检，没有写入云端。本地校验结果仍保留。");
    button.current?.focus();
  }
  const rows =
    result?.rows.filter((r) => filter === "all" || r.status === filter) || [];
  return (
    <section
      className="restore-preview"
      aria-labelledby="restore-preview-heading"
    >
      <h3 id="restore-preview-heading">恢复前只读预检</h3>
      <p>
        本机文件已校验。下一步会把该备份中的原文、条目正文、标签、时间、关联和附件元数据发送到你自己的
        Personal OS 服务，与本人 Supabase
        档案对比。图片、音频文件留在本机，不发送给 AI，也不保存这次提交的内容。
      </p>
      <p>
        {snapshot.records.length} 条记录 · {snapshot.entries.length}{" "}
        项关注、方向或复盘 · {snapshot.attachments.length}{" "}
        个附件的信息（含回收站）。可在下方按需展开本次文字与元数据。
      </p>
      <details onToggle={(e) => setShowPayload(e.currentTarget.open)}>
        <summary>查看本次发送的文字与元数据</summary>
        <pre className="preview-payload" tabIndex={0}>
          {payloadText}
        </pre>
      </details>
      <label className="check-label">
        <input
          type="checkbox"
          checked={consent}
          disabled={busy}
          onChange={(e) => {
            setConsent(e.target.checked);
            setResult(null);
          }}
        />
        我同意将以上文字与元数据发给自己的服务，只进行对比
      </label>
      <div className="button-row">
        <button
          ref={button}
          className="button primary"
          disabled={!consent || busy}
          onClick={() => void preview()}
        >
          {busy ? "正在预检…" : "只读对比云端"}
        </button>
        <button className="button secondary" onClick={cancel}>
          {busy ? "取消预检" : "清除预检结果"}
        </button>
      </div>
      <p role="status">{message}</p>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className="preview-results">
          <h4>
            {result.blocked
              ? "存在冲突或不支持内容，整批应停止"
              : "未发现元数据冲突"}
          </h4>
          <p>
            对比时点：
            {new Date(result.targetSnapshotAt).toLocaleString("zh-CN")}
            。这是一次快照，云端之后仍可能变化。
          </p>
          <p>
            待新增 {result.totals.new} 项 · 相同 {result.totals.same} 项 · 冲突{" "}
            {result.totals.conflict} 项 · 不支持 {result.totals.unsupported} 项
          </p>
          <p>
            云端另有 {result.targetOnly}{" "}
            项不在此包内，将保持原样。条目和原件分别计数；“相同”依据数据库元数据，未重新读取云端原件字节。
          </p>
          <div className="button-row" aria-label="预检结果筛选">
            {(["all", "new", "same", "conflict", "unsupported"] as const).map(
              (key) => (
                <button
                  key={key}
                  className="button quiet"
                  aria-pressed={filter === key}
                  onClick={() => {
                    setFilter(key);
                    setVisible(20);
                  }}
                >
                  {key === "all" ? "全部" : labels[key]}
                </button>
              ),
            )}
          </div>
          {!rows.length && <p>此类别没有内容。</p>}
          <ul className="preview-list">
            {rows.slice(0, visible).map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                <strong>
                  {kinds[r.kind]} · {titles.get(`${r.kind}:${r.id}`) || r.id}
                </strong>
                <p>
                  {labels[r.status]}
                  {r.inTrash ? " · 保留回收站状态" : ""}
                  {r.inactive ? " · 停用关注" : ""}
                </p>
                {r.reasons.length > 0 && <p>{r.reasons.join("；")}</p>}
                <small>编号：{r.id}</small>
              </li>
            ))}
          </ul>
          {rows.length > visible && (
            <button
              className="button secondary"
              onClick={() => setVisible((n) => n + 20)}
            >
              再显示 20 项（剩余 {rows.length - visible} 项）
            </button>
          )}
          <p>
            预检不是恢复授权，也不是可恢复证明。实际恢复写入尚未开放；没有新增、跳过执行、覆盖或恢复任何记录。
          </p>
        </div>
      )}
    </section>
  );
}
