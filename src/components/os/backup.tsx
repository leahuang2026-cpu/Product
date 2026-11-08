"use client";
import { useEffect, useRef, useState } from "react";
import { RestorePreview } from "./restore-preview";
import type { ValidatedBackup } from "@/lib/backup/validate";
import { LIMITS, type Snapshot, type Summary } from "@/lib/backup/format";

type Job = { abort: AbortController; worker?: Worker; stop?: () => void };
export function BackupPanel() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [error, setError] = useState(""),
    [summary, setSummary] = useState<Summary | null>(null);
  const [download, setDownload] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [consent, setConsent] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const job = useRef<Job | null>(null),
    url = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    exportButton = useRef<HTMLButtonElement>(null);
  function revoke() {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }
  useEffect(
    () => () => {
      job.current?.abort.abort();
      job.current?.stop?.();
      job.current?.worker?.terminate();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  function begin(): Job | null {
    if (job.current) return null;
    revoke();
    setDownload(null);
    setSummary(null);
    setSnapshot(null);
    setError("");
    setBusy(true);
    const current = { abort: new AbortController() };
    job.current = current;
    return current;
  }
  async function check(blob: Blob, current: Job): Promise<ValidatedBackup> {
    if (blob.size > LIMITS.zip) throw new Error("文件超过 64 MiB 校验上限。");
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("../../lib/backup/validate.worker.ts", import.meta.url),
      );
      current.worker = worker;
      current.stop = () => {
        worker.terminate();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      worker.onmessage = (event) => {
        worker.terminate();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data);
      };
      worker.onerror = () => {
        worker.terminate();
        reject(new Error("本地校验未完成，请重试或换用电脑浏览器。"));
      };
      worker.postMessage(blob);
    });
  }
  function finish(current: Job) {
    if (job.current !== current) return;
    current.worker?.terminate();
    job.current = null;
    setBusy(false);
  }
  function failure(e: unknown, current: Job) {
    if (job.current !== current) return;
    setSummary(null);
    setSnapshot(null);
    setDownload(null);
    revoke();
    setMessage("");
    setError(
      current.abort.signal.aborted
        ? "操作已取消或超时，尚未生成可下载的完整备份。云端内容未改变。"
        : e instanceof Error
          ? e.message
          : "备份未完成，请重试。",
    );
  }
  async function generate() {
    if (!consent) return;
    const current = begin();
    if (!current) return;
    const timer = setTimeout(() => {
      current.abort.abort();
      current.stop?.();
    }, LIMITS.timeout);
    setMessage("正在读取完整档案与原件…");
    try {
      const response = await fetch("/api/backups/export", {
        method: "POST",
        signal: current.abort.signal,
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || "完整备份未生成，请稍后重试。");
      }
      if (
        !response.body ||
        !response.headers.get("content-type")?.includes("application/zip")
      )
        throw new Error("收到的内容不是备份文件。");
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > LIMITS.zip)
            throw new Error("备份超过 64 MiB 传输上限，未保留残包。");
          chunks.push(value as Uint8Array<ArrayBuffer>);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (current.abort.signal.aborted || job.current !== current) return;
      const blob = new Blob(chunks, { type: "application/zip" });
      setMessage("已接收，正在本机校验完整性…");
      const result = await check(blob, current);
      if (current.abort.signal.aborted || job.current !== current) return;
      url.current = URL.createObjectURL(blob);
      setDownload({
        url: url.current,
        name: `personal-os-backup-${result.summary.snapshotAt.replace(/[:.]/g, "-")}.zip`,
      });
      setSummary(result.summary);
      setSnapshot(result.snapshot);
      setMessage("完整性校验通过，请点击保存文件。尚未确认文件已保存到设备。");
    } catch (e) {
      failure(e, current);
    } finally {
      clearTimeout(timer);
      finish(current);
    }
  }
  async function verify(file: File) {
    const current = begin();
    if (!current) return;
    const timer = setTimeout(() => {
      current.abort.abort();
      current.stop?.();
    }, LIMITS.timeout);
    setMessage("正在本机校验所选文件，不会上传…");
    try {
      const result = await check(file, current);
      if (current.abort.signal.aborted || job.current !== current) return;
      setSummary(result.summary);
      setSnapshot(result.snapshot);
      setMessage(
        "所选本地备份完整性校验通过。未验证目标空间恢复，也未写入云端。",
      );
    } catch (e) {
      failure(e, current);
    } finally {
      clearTimeout(timer);
      finish(current);
    }
  }
  function clear() {
    job.current?.abort.abort();
    job.current?.stop?.();
    job.current?.worker?.terminate();
    job.current = null;
    revoke();
    setDownload(null);
    setSummary(null);
    setSnapshot(null);
    setBusy(false);
    setError("");
    setMessage("已取消或清除本次文件选择，云端内容未改变。");
    if (fileInput.current) fileInput.current.value = "";
    exportButton.current?.focus();
  }
  return (
    <section className="panel backup-panel" aria-labelledby="backup-heading">
      <h2 id="backup-heading">云端档案备份</h2>
      <p>
        完整导出已保存的文字、原始附件、领域、灵感标记、关注、方向与复盘，包含回收站和停用关注，不受当前筛选影响。
      </p>
      <p>
        不包含账号、密钥、未保存草稿或未绑定的上传。未加密 ZIP
        含私人内容，请保存在自己的安全设备中。
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={consent}
          disabled={busy}
          onChange={(e) => setConsent(e.target.checked)}
        />
        我了解备份未加密，包含回收站内容
      </label>
      <div className="button-row">
        <button
          className="button primary"
          ref={exportButton}
          disabled={busy || !consent}
          onClick={() => void generate()}
        >
          生成完整云端备份
        </button>
        <button className="button secondary" onClick={clear}>
          {busy ? "取消本次操作" : "清除文件与结果"}
        </button>
      </div>
      <p className="muted">
        当前验证范围：原件合计 50 MB、单件 10 MB、记录与条目合计 5,000 项、附件
        1,000 个、元数据 8 MiB、ZIP 64 MiB。超限会停止，不省略内容。
      </p>
      <label>
        校验已有备份（仅在本机读取）
        <input
          ref={fileInput}
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void verify(file);
          }}
        />
      </label>
      <div role="status" aria-live="polite">
        {message}
      </div>
      {error && <p role="alert">{error}</p>}
      {summary && (
        <div className="backup-summary">
          <p>
            快照时间：{new Date(summary.snapshotAt).toLocaleString("zh-CN")}
          </p>
          <p>
            {summary.counts.records} 条记录（回收站{" "}
            {summary.counts.trashedRecords} 条） · {summary.counts.attachments}{" "}
            个原件
          </p>
          <p>
            {summary.counts.focus} 项关注（停用 {summary.counts.inactiveFocus}{" "}
            项） · {summary.counts.directions} 个方向 ·{" "}
            {summary.counts.reflections} 篇复盘（方向与复盘回收站合计{" "}
            {summary.counts.trashedEntries} 项）
          </p>
        </div>
      )}
      {download && (
        <a
          className="button primary"
          href={download.url}
          download={download.name}
        >
          保存备份文件
        </a>
      )}
      {snapshot && <RestorePreview snapshot={snapshot} />}
      <p>
        此阶段支持导出、校验和只读预检。从备份恢复尚未开放；校验通过不等于已验证可恢复。文件下载位置由浏览器决定，离开页面后需重新生成。
      </p>
    </section>
  );
}
