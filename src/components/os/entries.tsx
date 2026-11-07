"use client";
import { useRef, useState } from "react";
import { useData, useOS } from "./context";
import { Dialog, DomainPicker, Empty, Notice, Tags } from "./common";
import { request } from "@/lib/os/client";
import {
  matchesDomains,
  titleOf,
  type Entry,
  type RecordItem,
} from "@/lib/os/model";
import { Composer } from "./composer";
import { ArrowUpRight, Plus } from "lucide-react";
function EntryEditor({
  kind,
  entry,
  entries,
  onClose,
}: {
  kind: Entry["kind"];
  entry?: Entry;
  entries: Entry[];
  onClose: () => void;
}) {
  const { reload, setDirty, navigate } = useOS();
  const records = useData<RecordItem[]>("/api/records");
  const [value, setValue] = useState<Entry>(
      entry || {
        id: crypto.randomUUID(),
        kind,
        title: "",
        body: "",
        domains: [],
        next: "",
        relationId: null,
        sourceIds: [],
        active: true,
        cadence: "weekly",
        version: 0,
      },
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  function edit(patch: Partial<Entry>) {
    setValue((v) => ({ ...v, ...patch }));
    setDirty(true);
    key.current = crypto.randomUUID();
  }
  async function save() {
    setError("");
    setBusy(true);
    try {
      await request<Entry>("/api/entries", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify(value),
      });
      setDirty(false);
      reload();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        kind === "focus"
          ? "此刻在意什么"
          : kind === "direction"
            ? "写下一个方向"
            : "写一次复盘"
      }
      onClose={() => navigate(onClose)}
    >
      <form
        className="entry-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          标题（可选）
          <input
            maxLength={120}
            value={value.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
        {kind === "reflection" && (
          <label>
            复盘周期
            <select
              value={value.cadence}
              onChange={(e) =>
                edit({ cadence: e.target.value as "weekly" | "monthly" })
              }
            >
              <option value="weekly">周度</option>
              <option value="monthly">月度</option>
            </select>
          </label>
        )}
        <label>
          {kind === "reflection"
            ? "这段时间，想对自己说些什么"
            : kind === "direction"
              ? "为什么在意，希望发生什么"
              : "为什么在意"}
          <textarea
            value={value.body}
            maxLength={10000}
            rows={6}
            onChange={(e) => edit({ body: e.target.value })}
          />
        </label>
        <DomainPicker
          value={value.domains}
          onChange={(domains) => edit({ domains })}
        />
        {kind === "focus" && (
          <>
            <label>
              关联方向（可空）
              <select
                value={value.relationId || ""}
                onChange={(e) => edit({ relationId: e.target.value || null })}
              >
                <option value="">暂不关联</option>
                {entries
                  .filter((x) => x.kind === "direction")
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title || x.body.slice(0, 30)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              一条下一步（可空）
              <input
                value={value.next}
                maxLength={200}
                onChange={(e) => edit({ next: e.target.value })}
              />
            </label>
          </>
        )}
        {kind !== "focus" && (
          <section className="source-picker">
            <h3>{kind === "reflection" ? "本次回看的材料" : "相关记录"}</h3>
            <p>由你选择；没有材料也可以写下自己的想法。</p>
            {records.loading ? (
              <p>正在读取材料…</p>
            ) : records.error ? (
              <Notice error={records.error} onRetry={records.retry} />
            ) : (
              records.data?.map((r) => (
                <label className="check-label" key={r.id}>
                  <input
                    type="checkbox"
                    checked={value.sourceIds.includes(r.id)}
                    onChange={(e) =>
                      edit({
                        sourceIds: e.target.checked
                          ? [...value.sourceIds, r.id]
                          : value.sourceIds.filter((id) => id !== r.id),
                      })
                    }
                  />
                  {titleOf(r)}
                </label>
              ))
            )}
          </section>
        )}
        {error && <Notice error={error} />}
        <div className="button-row">
          <button className="button primary" disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
          <button
            className="button quiet"
            type="button"
            onClick={() => navigate(onClose)}
          >
            取消
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function EntriesView({
  kind,
  home = false,
}: {
  kind: Entry["kind"];
  home?: boolean;
}) {
  const { domains, reload } = useOS();
  const { data, error, loading, retry } = useData<Entry[]>("/api/entries");
  const [editing, setEditing] = useState<Entry | "new" | null>(null),
    [issue, setIssue] = useState(""),
    [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const items = (data || []).filter(
    (e) =>
      e.kind === kind &&
      (kind !== "focus" || e.active) &&
      matchesDomains(e.domains, domains) &&
      (kind !== "reflection" || e.cadence === period),
  );
  const title =
    kind === "focus"
      ? "把注意力，放回自己在意的事"
      : kind === "direction"
        ? "未来，可以慢慢清晰"
        : "停下来，听听自己的想法";
  async function remove(entry: Entry) {
    if (!window.confirm("移出当前关注？相关记录和方向会保留。")) return;
    try {
      await request("/api/entries", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ ...entry, active: false }),
      });
      reload();
    } catch (e) {
      setIssue((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">
            {kind === "focus"
              ? "FOCUS · 现在"
              : kind === "direction"
                ? "DIRECTION · 未来"
                : "REFLECTION · 回望"}
          </span>
          <h1>{title}</h1>
          <p>
            {kind === "focus"
              ? "不急着做更多。看见此刻，也记得为什么出发。"
              : kind === "direction"
                ? "目标可以随人生变化，方向始终由你决定。"
                : "这里没有评分，也不需要每次都得出下一步。"}
          </p>
        </div>
        <button className="button secondary" onClick={() => setEditing("new")}>
          <Plus size={17} />
          {kind === "focus"
            ? "添加关注"
            : kind === "direction"
              ? "添加方向"
              : "写复盘"}
        </button>
      </div>
      {home && (
        <section className="home-capture">
          <h2>此刻，想留下什么？</h2>
          <Composer />
        </section>
      )}
      {kind === "reflection" && (
        <div className="period-tabs">
          <button
            aria-pressed={period === "weekly"}
            onClick={() => setPeriod("weekly")}
          >
            周度复盘
          </button>
          <button
            aria-pressed={period === "monthly"}
            onClick={() => setPeriod("monthly")}
          >
            月度复盘
          </button>
        </div>
      )}
      {issue && <Notice error={issue} />}
      <section className={`entries entries-${kind}`}>
        {loading ? (
          <p role="status">正在读取…</p>
        ) : error ? (
          <Notice error={error} onRetry={retry} />
        ) : !items.length ? (
          <Empty
            title={
              domains.length
                ? "当前领域还没有匹配内容"
                : kind === "focus"
                  ? "给当下，留一个关注的位置"
                  : kind === "direction"
                    ? "方向可以从一句在意的话开始"
                    : "第一次回望，从此刻开始"
            }
          />
        ) : (
          items.map((entry, i) => (
            <article
              key={entry.id}
              className={`entry-card ${kind === "focus" && i === 0 ? "focus-primary" : ""}`}
            >
              <Tags values={entry.domains} />
              <h2>{entry.title || entry.body.split("\n")[0].slice(0, 60)}</h2>
              <p className="preserve-lines">{entry.body}</p>
              {kind === "focus" && (
                <>
                  <div className="next-step">
                    <span>下一步</span>
                    <p>{entry.next || "还没有填写，慢慢来。"}</p>
                  </div>
                  <p className="related-context">
                    关联方向：
                    {data?.find((e) => e.id === entry.relationId)?.title ||
                      "暂未关联"}
                  </p>
                </>
              )}
              {entry.sourceIds.length > 0 && (
                <div className="source-links">
                  <h3>来源记录</h3>
                  {entry.sourceIds.map((id, n) => (
                    <a href={`/archive/${id}`} key={id}>
                      查看来源 {n + 1}
                      <ArrowUpRight size={14} />
                    </a>
                  ))}
                </div>
              )}
              {kind === "direction" && (
                <p className="related-context">
                  {
                    (data || []).filter(
                      (e) =>
                        e.kind === "focus" &&
                        e.active &&
                        e.relationId === entry.id,
                    ).length
                  }{" "}
                  项当前关注引用此方向
                </p>
              )}
              <div className="button-row">
                <button
                  className="button quiet"
                  onClick={() => setEditing(entry)}
                >
                  编辑
                </button>
                {kind === "focus" && (
                  <button
                    className="button quiet"
                    onClick={() => void remove(entry)}
                  >
                    移出当前关注
                  </button>
                )}
                {kind === "direction" && (
                  <button
                    className="button quiet"
                    onClick={() => {
                      if (
                        window.confirm(
                          "以这个方向建立当前阶段关注？你可以在表单中调整本阶段范围。",
                        )
                      )
                        setEditing({
                          id: crypto.randomUUID(),
                          kind: "focus",
                          title: entry.title,
                          body: "",
                          domains: entry.domains,
                          next: "",
                          relationId: entry.id,
                          sourceIds: [],
                          active: true,
                          version: 0,
                        });
                    }}
                  >
                    加入当前关注
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
      {kind === "reflection" && (
        <p className="subtle-note">
          先用自己的话回望。AI 整理尚未启用，材料不会自动发送。
        </p>
      )}
      {editing && (
        <EntryEditor
          kind={editing === "new" ? kind : editing.kind}
          entry={editing === "new" ? undefined : editing}
          entries={data || []}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
