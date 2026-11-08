"use client";
import Image from "next/image";
import { useState } from "react";
import { useOS } from "./context";
import { BackupPanel } from "./backup";
import { TrashPanel } from "./trash";
import { Login } from "./auth";
import { Notice } from "./common";
import { parseImport, STORAGE_KEY, type AppState } from "@/lib/domain";
export function SettingsView() {
  const { session, sessionError } = useOS();
  const [legacy, setLegacy] = useState<AppState | null>(null),
    [error, setError] = useState("");
  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setLegacy(raw ? parseImport(raw) : null);
      setError(raw ? "" : "此浏览器没有旧版档案。");
    } catch {
      setError("旧版档案无法解析，请保留原始备份后处理。");
    }
  }
  function exportLegacy() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setError("此浏览器没有旧版档案。");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "personal-os-legacy-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR PRIVATE SPACE</span>
          <h1>隐私与设置</h1>
          <p>你的记录，由你掌握。</p>
        </div>
      </div>
      <Login />
      <TrashPanel />
      {session || sessionError ? (
        <BackupPanel
          key={session?.authenticated ? "signed-in" : "signed-out"}
        />
      ) : (
        <p role="status">正在确认会话，随后可导出或在本机校验备份…</p>
      )}
      <section className="panel">
        <h2>原有浏览器档案</h2>
        <p>
          旧版记录与灵感原样保留。可以只读查看或导出备份，尚未自动导入云端。
        </p>
        <div className="button-row">
          <button className="button secondary" onClick={read}>
            查看旧版档案
          </button>
          <button className="button quiet" onClick={exportLegacy}>
            导出旧版原始备份
          </button>
        </div>
        {error && <Notice error={error} />}{" "}
        {legacy && (
          <div className="legacy-list">
            <p>
              {legacy.records.length} 条记录 · {legacy.ideas.length} 条旧版灵感
            </p>
            {legacy.records.map((r) => (
              <details key={r.id}>
                <summary>{r.title}</summary>
                <p className="preserve-lines">{r.raw}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    原始链接
                  </a>
                )}
                {r.attachment &&
                  (r.attachment.mime.startsWith("image/") ? (
                    <Image
                      unoptimized
                      width={1200}
                      height={800}
                      src={r.attachment.data}
                      alt={r.attachment.name}
                    />
                  ) : (
                    <audio src={r.attachment.data} controls />
                  ))}
              </details>
            ))}
            {legacy.ideas.map((i) => (
              <details key={i.id}>
                <summary>{i.title} · 旧版灵感</summary>
                <p className="preserve-lines">{i.body}</p>
                <small>历史状态：{i.status}（只读）</small>
              </details>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <h2>同步与导出</h2>
        <p>
          云端保存以服务端确认和另一设备读回为准。云端备份见上方独立入口；旧版备份仅包含此浏览器原有数据。
        </p>
      </section>
    </>
  );
}
