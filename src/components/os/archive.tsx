"use client";
import { TrashAction, TrashLink } from "./trash";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useOS, useData } from "./context";
import { Notice, Empty, DomainPicker, Tags, dateLabel, Dialog } from "./common";
import { Composer } from "./composer";
import { request } from "@/lib/os/client";
import {
  matchesRecord,
  titleOf,
  type RecordItem,
  type Domain,
} from "@/lib/os/model";
import { safeImagePath } from "@/lib/server/security";
import { ArrowLeft, Sprout, Search, X } from "lucide-react";
export function RecordDetail({
  record,
  onBack,
  onUpdate,
  onRemoved,
}: {
  record: RecordItem;
  onBack?: () => void;
  onUpdate?: (r: RecordItem) => void;
  onRemoved?: () => void;
}) {
  const router = useRouter();
  const { reload, setDirty, navigate } = useOS();
  const sources = useData<RecordItem[]>("/api/records");
  const [current, setCurrent] = useState(record),
    [selected, setSelected] = useState<Domain[]>(record.domains),
    [note, setNote] = useState(record.note),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [exploring, setExploring] = useState(false);
  const pending = useRef<{ body: string; key: string } | null>(null);
  const dirty =
    note !== current.note ||
    JSON.stringify(selected) !== JSON.stringify(current.domains);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  async function update(mark?: boolean) {
    setBusy(true);
    setError("");
    const body = JSON.stringify(
      mark === undefined
        ? { version: current.version, domains: selected, note }
        : { version: current.version, isIdea: mark },
    );
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    try {
      const result = await request<RecordItem>(`/api/records/${current.id}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": pending.current.key },
        body,
      });
      setCurrent(result);
      setSelected(result.domains);
      setNote(result.note);
      setMessage(
        mark === undefined
          ? "说明与领域已保存。"
          : mark
            ? "已留在灵感库。"
            : "已取消标记，原文仍在档案中。",
      );
      pending.current = null;
      setDirty(false);
      onUpdate?.(result);
      if (!onUpdate) reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="reading-pane">
      <div className="reading-top">
        {onBack && (
          <button className="button quiet" onClick={() => navigate(onBack)}>
            <ArrowLeft size={17} />
            返回列表
          </button>
        )}
        <span>{dateLabel(current.createdAt)}</span>
      </div>
      <Tags values={current.domains} />
      <h2>{titleOf(current)}</h2>
      {current.sourceId &&
        (sources.data?.some((r) => r.id === current.sourceId) ? (
          <a href={`/archive/${current.sourceId}`}>查看来源记录</a>
        ) : (
          <p className="subtle-note">
            {sources.loading
              ? "正在读取来源…"
              : "来源已移入回收站或暂不可用；引用关系保留。"}
          </p>
        ))}
      <div className="original-content">
        <h3>原始记录</h3>
        {current.originalText && <p>{current.originalText}</p>}
        {current.attachments.map((a) => (
          <figure key={a.id}>
            {safeImagePath(a.contentPath) ? (
              a.mime.startsWith("image/") ? (
                <>
                  <Image
                    unoptimized
                    width={1200}
                    height={800}
                    src={a.contentPath}
                    alt={a.name}
                  />
                  <a href={a.contentPath} target="_blank" rel="noreferrer">
                    查看原图 · {a.name}
                  </a>
                </>
              ) : (
                <>
                  <audio controls src={a.contentPath} />
                  <figcaption>{a.name} · 原始录音</figcaption>
                </>
              )
            ) : (
              <Notice error="附件地址无效，未加载原件。" />
            )}
          </figure>
        ))}
        {current.links.map((url, i) =>
          /^https?:\/\//i.test(url) ? (
            <a
              className="original-link"
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              {url}
            </a>
          ) : null,
        )}
      </div>
      <section className="metadata-editor">
        <label>
          补充说明
          <textarea
            value={note}
            maxLength={10000}
            rows={3}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <DomainPicker
          value={selected}
          onChange={setSelected}
          disabled={busy}
          label="记录领域"
        />
        <div className="button-row">
          <button
            className="button secondary"
            disabled={busy || !dirty}
            onClick={() => void update()}
          >
            保存说明与领域
          </button>
          <button
            className="button quiet"
            disabled={busy || dirty}
            onClick={() => void update(!current.isIdea)}
          >
            <Sprout size={17} />
            {current.isIdea ? "取消灵感标记" : "留在灵感库"}
          </button>
        </div>
        <div className="button-row">
          <TrashAction
            id={current.id}
            kind="record"
            version={current.version}
            disabled={dirty || busy}
            onDone={
              onRemoved ||
              (() => {
                router.push("/archive");
              })
            }
          />
          <TrashLink />
        </div>
        {message && <p role="status">{message}</p>}
        {error && <Notice error={error} />}
        <button
          className="button quiet"
          disabled={dirty || busy}
          onClick={() => setExploring(true)}
        >
          继续探索 · 手写补充
        </button>
      </section>
      {exploring && (
        <Dialog
          title="继续探索"
          onClose={() => navigate(() => setExploring(false))}
        >
          <Composer sourceId={current.id} onDone={() => setExploring(false)} />
        </Dialog>
      )}
    </article>
  );
}
export function ArchiveView({ garden = false }: { garden?: boolean }) {
  const { domains, setDomains, setComposer } = useOS();
  const { data, setData, error, loading, retry } =
    useData<RecordItem[]>("/api/records");
  const [query, setQuery] = useState(""),
    [unclassified, setUnclassified] = useState(false),
    [selected, setSelected] = useState<RecordItem | null>(null);
  const lastButton = useRef<HTMLElement | null>(null);
  const records = (data || [])
    .filter(
      (r) =>
        (!garden || r.isIdea) && matchesRecord(r, query, domains, unclassified),
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
  function back() {
    setSelected(null);
    queueMicrotask(() => lastButton.current?.focus());
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">
            {garden ? "IDEA GARDEN" : "MEMORY · ARCHIVE"}
          </span>
          <h1>{garden ? "留一片地方，给灵感" : "过去，仍在与你对话"}</h1>
          <p>
            {garden
              ? "不急着行动。这里是你主动留下的那些可能性。"
              : "从记录里，找回当时的自己。"}
          </p>
        </div>
        <button className="button secondary" onClick={() => setComposer(true)}>
          记录此刻
        </button>
      </div>
      <TrashLink />
      <div className={`archive-layout ${selected ? "has-selection" : ""}`}>
        <section className="archive-list">
          <div className="archive-tools">
            <label className="search-box">
              <Search size={18} />
              <input
                id="archive-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索正文和图片说明"
                aria-label="搜索记录"
              />
              {query && (
                <button
                  className="icon-button"
                  onClick={() => setQuery("")}
                  aria-label="清除搜索"
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={unclassified}
                onChange={(e) => setUnclassified(e.target.checked)}
              />
              只看未分类
            </label>
            {(query || domains.length > 0 || unclassified) && (
              <button
                className="button quiet"
                onClick={() => {
                  setQuery("");
                  setDomains([]);
                  setUnclassified(false);
                }}
              >
                清除筛选
              </button>
            )}
          </div>
          {loading ? (
            <p role="status">正在读取记录…</p>
          ) : error ? (
            <Notice error={error} onRetry={retry} />
          ) : !records.length ? (
            <Empty
              title={
                data?.length || query || domains.length || unclassified
                  ? "没有匹配的记录"
                  : garden
                    ? "灵感可以从一条记录开始"
                    : "留下第一条属于你的记录"
              }
            >
              <button
                className="button quiet"
                onClick={() => {
                  if (data?.length || query || domains.length || unclassified) {
                    setQuery("");
                    setDomains([]);
                    setUnclassified(false);
                  } else setComposer(true);
                }}
              >
                {data?.length || query || domains.length || unclassified
                  ? "清除条件"
                  : "开始记录"}
              </button>
            </Empty>
          ) : (
            <div className={garden ? "garden-grid" : "record-list"}>
              {records.map((r) => (
                <button
                  className={`record-card ${garden ? "idea-note" : ""} ${selected?.id === r.id ? "selected" : ""}`}
                  key={r.id}
                  aria-pressed={selected?.id === r.id}
                  onClick={(e) => {
                    lastButton.current = e.currentTarget;
                    setSelected(r);
                  }}
                >
                  <div className="card-meta">
                    <Tags values={r.domains} />
                    {r.isIdea && <Sprout size={16} aria-label="灵感" />}
                  </div>
                  <h2>{titleOf(r)}</h2>
                  <p>
                    {r.originalText ||
                      r.note ||
                      `${r.attachments.length} 个原始附件`}
                  </p>
                  <small>
                    {dateLabel(r.createdAt)}
                    {r.attachments.length > 0 &&
                      ` · ${r.attachments.length} 个附件`}
                  </small>
                </button>
              ))}
            </div>
          )}
        </section>
        {selected ? (
          <RecordDetail
            key={selected.id}
            record={selected}
            onBack={back}
            onRemoved={() => {
              setSelected(null);
              retry();
            }}
            onUpdate={(r) => {
              setSelected(r);
              setData(
                (items) => items?.map((x) => (x.id === r.id ? r : x)) || null,
              );
            }}
          />
        ) : (
          <div className="reading-placeholder">
            <span>每一条记录，都有它的来处。</span>
            <p>选择左侧记录，完整阅读原文与附件。</p>
          </div>
        )}
      </div>
    </>
  );
}
export function DetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, loading, retry } = useData<RecordItem>(
    `/api/records/${encodeURIComponent(id)}`,
  );
  return (
    <>
      {loading ? (
        <p role="status">正在读取原始记录…</p>
      ) : error ? (
        <Notice error={error} onRetry={retry} />
      ) : data ? (
        <RecordDetail
          key={`${data.id}-${data.version}`}
          record={data}
          onBack={() => {
            if (window.history.length > 1) window.history.back();
            else router.push("/archive");
          }}
        />
      ) : null}
    </>
  );
}
