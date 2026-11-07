"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Feather,
  Link2,
  Image as ImageIcon,
  Mic,
  Sparkles,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Sprout,
  Compass,
  BookOpen,
  Check,
  LockKeyhole,
  Archive as ArchiveIcon,
  Leaf,
  CalendarDays,
} from "lucide-react";
import { useStore } from "./store";
import { Empty, Modal, More, SectionTitle, Tag } from "./ui";
import {
  type AppState,
  type CaptureRecord,
  type Domain,
  type Idea,
  domains,
  ideaLabels,
  ideaStates,
  recordSchema,
  filterRecords,
  decideSuggestion,
  emptyState,
  exportState,
  parseImport,
  prettyDate,
  STORAGE_KEY,
} from "@/lib/domain";
import { seedState } from "@/lib/seed";

function DomainSelect({
  value,
  onChange,
}: {
  value: Domain;
  onChange: (d: Domain) => void;
}) {
  return (
    <select
      aria-label="所属领域"
      value={value}
      onChange={(e) => onChange(e.target.value as Domain)}
    >
      {domains.map((d) => (
        <option key={d}>{d}</option>
      ))}
    </select>
  );
}
function download(name: string, value: string) {
  const url = URL.createObjectURL(
    new Blob([value], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function PanelHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function Workspace({ section }: { section: string }) {
  const { ready } = useStore();
  if (!ready)
    return (
      <div className="loading" role="status">
        <Sprout /> 正在打开你的空间…
      </div>
    );
  return (
    <div className="page-content">
      {section === "home" ? (
        <Home />
      ) : section === "capture" ? (
        <>
          <SectionTitle
            eyebrow="QUICK CAPTURE"
            title="把此刻，留下来"
            text="一个想法、一段经历、一点心情，都值得拥有自己的位置。"
          />
          <Capture />
        </>
      ) : section === "archive" ? (
        <Archive />
      ) : section === "focus" ? (
        <Focus />
      ) : section === "direction" ? (
        <Direction />
      ) : section === "ideas" ? (
        <Ideas />
      ) : section === "reflection" ? (
        <Reflection />
      ) : (
        <Settings />
      )}
    </div>
  );
}
function Home() {
  const { state } = useStore();
  return (
    <>
      <div className="home-greeting">
        <div>
          <span className="eyebrow">YOUR LIFE, IN PERSPECTIVE</span>
          <h1>
            给生活，一点留白<span className="title-dot">。</span>
          </h1>
          <p>过去的沉淀，现在的关注，未来的方向。</p>
        </div>
        <div className="date-note">
          <CalendarDays size={15} />
          <span>
            {prettyDate(new Date().toISOString())}
            <small>今天，也是一段值得记录的日子</small>
          </span>
        </div>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span /> 慢慢来，比较快
          </span>
          <h2>
            你正在成为的样子，
            <br />
            藏在每一个平常的日子里。
          </h2>
          <p>
            记录一点，关注一点，再向自己靠近一点。
            <br />
            这里是你的生活，不必成为一张待办清单。
          </p>
          <Link className="button primary" href="/capture">
            <Plus size={17} /> 记录此刻 <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-sun" />
          <div className="art-card card-back">
            <span>GROW AT YOUR OWN PACE</span>
            <div className="art-rule" />
            <div className="art-rule short" />
          </div>
          <div className="art-card card-front">
            <Sprout size={82} strokeWidth={1} />
            <span>给想法一点生长的时间</span>
            <small>a little, every day</small>
          </div>
          <span className="art-star star-one">✳</span>
          <span className="art-star star-two">✧</span>
          <span className="art-caption">COLLECT MOMENTS. FIND YOUR WAY.</span>
        </div>
      </section>
      <div className="journey-grid">
        <Link href="/archive" className="journey-card">
          <span className="journey-icon clay">
            <ArchiveIcon size={21} />
          </span>
          <div>
            <small>PAST · 过去</small>
            <h3>让经历有所沉淀</h3>
            <p>{state.records.length} 条记录，串起自己的故事</p>
          </div>
          <ArrowUpRight size={18} />
        </Link>
        <Link href="/focus" className="journey-card">
          <span className="journey-icon sage">
            <Leaf size={21} />
          </span>
          <div>
            <small>PRESENT · 现在</small>
            <h3>把注意力放回当下</h3>
            <p>{state.projects.length} 个阶段重点，少一点也很好</p>
          </div>
          <ArrowUpRight size={18} />
        </Link>
        <Link href="/direction" className="journey-card">
          <span className="journey-icon lavender">
            <Compass size={21} />
          </span>
          <div>
            <small>FUTURE · 未来</small>
            <h3>朝在意的方向生长</h3>
            <p>{state.goals.length} 个方向，保留探索的余地</p>
          </div>
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <PanelHead title="此刻，想留下什么？" subtitle="先记录，不急着整理。">
            <Feather size={20} className="muted" />
          </PanelHead>
          <Capture compact />
        </section>
        <section className="panel focus-preview">
          <PanelHead title="当下关注">
            <More href="/focus">查看全部</More>
          </PanelHead>
          {state.projects.length ? (
            state.projects.slice(0, 2).map((p, i) => (
              <Link href="/focus" className="focus-row" key={p.id}>
                <span className="focus-number">0{i + 1}</span>
                <div>
                  <Tag domain={p.domain} />
                  <h3>{p.title}</h3>
                  <p>
                    {p.actions.find((a) => !a.done)?.title ||
                      "留一点时间，回顾这个阶段"}
                  </p>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))
          ) : (
            <Empty title="为当下留一个重点" />
          )}
          <div className="gentle-note">
            <Leaf size={14} /> 专注，是给重要的事留出空间。
          </div>
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <section className="panel">
          <PanelHead title="最近的沉淀">
            <More href="/archive">打开档案</More>
          </PanelHead>
          {state.records.length ? (
            state.records.slice(0, 3).map((r) => (
              <Link href="/archive" key={r.id} className="recent-record">
                <span className={`record-glyph domain-${r.domain}`}>
                  <Feather size={18} />
                </span>
                <div>
                  <h3>{r.title}</h3>
                  <p>
                    {prettyDate(r.createdAt)}
                    <span>·</span>
                    {r.tags[0] || r.domain}
                  </p>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))
          ) : (
            <Empty title="你的故事，从第一条记录开始" />
          )}
        </section>
        <section className="garden-preview">
          <span className="eyebrow">A LITTLE ROOM FOR POSSIBILITY</span>
          <Sprout size={36} strokeWidth={1.3} />
          <h2>
            有些想法，
            <br />
            只需要一片花园。
          </h2>
          <p>
            不必立刻有用，也不必变成任务。
            <br />让 {state.ideas.length} 个灵感，在这里慢慢生长。
          </p>
          <More href="/ideas">去灵感花园走走</More>
        </section>
      </div>
      <Link href="/reflection" className="reflection-strip">
        <span className="reflection-icon">
          <BookOpen size={24} />
        </span>
        <div>
          <h3>偶尔停下来，看看走过的路</h3>
          <p>一次温柔的复盘，重新认识当下的自己。</p>
        </div>
        <span className="text-link">
          开始复盘 <ArrowRight size={16} />
        </span>
      </Link>
    </>
  );
}
function Capture({ compact = false }: { compact?: boolean }) {
  const { update } = useStore();
  const [raw, setRaw] = useState("");
  const [kind, setKind] = useState<CaptureRecord["kind"]>("text");
  const [domain, setDomain] = useState<Domain>("自我");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [attachment, setAttachment] = useState<CaptureRecord["attachment"]>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const types = [
    { key: "text", label: "文字", icon: Feather },
    { key: "audio", label: "语音", icon: Mic },
    { key: "image", label: "图片", icon: ImageIcon },
    { key: "link", label: "链接", icon: Link2 },
  ] as const;
  async function loadFile(file: File | undefined) {
    setAttachment(undefined);
    setError("");
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("本地体验版单个附件最多 1 MB，请选择较小文件。");
      return;
    }
    const allowed =
      kind === "image"
        ? ["image/jpeg", "image/png", "image/webp"]
        : ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"];
    if (!allowed.includes(file.type)) {
      setError("请选择支持的图片或音频格式。");
      return;
    }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setAttachment({
        name: file.name,
        mime: file.type as NonNullable<CaptureRecord["attachment"]>["mime"],
        data,
      });
    } catch {
      setError("文件读取失败，请重试。");
    } finally {
      setReading(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const content = raw.trim() ? raw : attachment?.name || url.trim();
    const result = recordSchema.safeParse({
      id: crypto.randomUUID(),
      title: (content.split("\n").find((line) => line.trim()) || "")
        .trim()
        .slice(0, 60),
      raw: content,
      kind,
      domain,
      url: kind === "link" ? url.trim() : undefined,
      attachment: kind === "audio" || kind === "image" ? attachment : undefined,
      tags: [
        ...new Set(
          tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
      createdAt: new Date().toISOString(),
      ai: null,
    });
    if (!result.success) {
      setError(
        "请补充记录内容或对应附件；链接需以 http:// 或 https:// 开头，标签最多 10 个、每个 30 字。",
      );
      return;
    }
    if (update((s) => ({ ...s, records: [result.data, ...s.records] }))) {
      setRaw("");
      setUrl("");
      setTags("");
      setAttachment(undefined);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("已存入人生档案。原始记录已保留。");
    }
  }
  return (
    <form
      onSubmit={submit}
      className={`capture-form ${compact ? "compact" : "panel capture-full"}`}
    >
      <div className="capture-types" role="group" aria-label="记录类型">
        {types.map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            key={key}
            disabled={reading}
            aria-pressed={kind === key}
            className={kind === key ? "selected" : ""}
            onClick={() => {
              setKind(key);
              setAttachment(undefined);
              setError("");
              setMessage("");
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="capture-content">
        记录内容
      </label>
      <textarea
        id="capture-content"
        maxLength={10000}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="此刻的想法、今天的小事，或是一个突然冒出的念头…"
        rows={compact ? 3 : 7}
      />
      {kind === "link" && (
        <label className="field">
          链接地址
          <input
            type="url"
            required
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <small>仅保存你提供的链接，不会自动抓取网页。</small>
        </label>
      )}
      {(kind === "image" || kind === "audio") && (
        <label className="upload-field">
          <ArrowUpFromLine size={18} />
          <span>
            {attachment
              ? attachment.name
              : kind === "image"
                ? "选择图片（JPEG / PNG / WebP）"
                : "选择音频（MP3 / WAV / OGG / WebM / M4A）"}
          </span>
          <input
            key={kind}
            ref={fileRef}
            type="file"
            accept={
              kind === "image"
                ? "image/jpeg,image/png,image/webp"
                : "audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4"
            }
            onChange={(e) => void loadFile(e.target.files?.[0])}
          />
          <small>单个附件 ≤ 1 MB；音频暂不转写。</small>
        </label>
      )}
      {!compact && (
        <label className="field">
          标签
          <input
            value={tags}
            maxLength={310}
            onChange={(e) => setTags(e.target.value)}
            placeholder="例如：日常觉察，阅读（用逗号分隔）"
          />
        </label>
      )}
      <div className="capture-bottom">
        <div>
          <DomainSelect value={domain} onChange={setDomain} />
          <span className="privacy-note">
            <LockKeyhole size={11} /> 仅此浏览器
          </span>
        </div>
        <button className="button primary" disabled={reading} type="submit">
          {reading ? "读取中…" : "保存记录"}
          <ArrowUpRight size={15} />
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success-message">
          {message} <Link href="/archive">查看 →</Link>
        </p>
      )}
    </form>
  );
}
function Archive() {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("全部");
  const [selected, setSelected] = useState<CaptureRecord | null>(null);
  const records = filterRecords(state.records, query, domain);
  return (
    <>
      <SectionTitle
        eyebrow="ARCHIVE · 过去的沉淀"
        title="人生档案"
        text="原始的经历、逐渐清晰的想法，都是你的来路。"
        action={
          <Link className="button primary" href="/capture">
            <Plus size={16} /> 添加记录
          </Link>
        }
      />
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="搜索记录"
            placeholder="搜索内容、标题或标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="muted">{records.length} 条记录</span>
      </div>
      <div className="filter-tabs" role="group" aria-label="领域筛选">
        {["全部", ...domains].map((d) => (
          <button
            aria-pressed={domain === d}
            className={domain === d ? "selected" : ""}
            key={d}
            onClick={() => setDomain(d)}
          >
            {d}
          </button>
        ))}
      </div>
      {records.length ? (
        <div className="archive-grid">
          {records.map((r) => (
            <button
              className="archive-card"
              key={r.id}
              onClick={() => setSelected(r)}
            >
              <div>
                <Tag domain={r.domain} />
                <span className="muted">{prettyDate(r.createdAt)}</span>
              </div>
              <h2>{r.title}</h2>
              <p>{r.raw}</p>
              <div className="record-card-footer">
                <span>
                  {r.tags.map((t) => `#${t}`).join(" ") ||
                    {
                      text: "文字记录",
                      link: "链接收藏",
                      image: "图片记录",
                      audio: "音频记录",
                    }[r.kind]}
                </span>
                <ArrowUpRight size={17} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title={
            query || domain !== "全部"
              ? "暂时没有匹配的记录"
              : "留下第一段属于你的故事"
          }
        >
          {query ? "试试其他关键词或领域。" : "从随手记一笔开始。"}
        </Empty>
      )}
      {selected && (
        <Modal title="记录详情" onClose={() => setSelected(null)}>
          <div className="record-detail">
            <Tag domain={selected.domain} />
            <h2>{selected.title}</h2>
            <small className="muted">
              {prettyDate(selected.createdAt)} · 私人记录
            </small>
            <h3>原始记录</h3>
            <p className="preserve-lines">{selected.raw}</p>
            {selected.url && (
              <a
                className="text-link wrap-link"
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {selected.url}
                <ArrowUpRight size={15} />
              </a>
            )}
            {selected.attachment && (
              <div className="attachment-preview">
                {selected.kind === "image" ? (
                  <Image
                    unoptimized
                    width={640}
                    height={400}
                    src={selected.attachment.data}
                    alt={selected.attachment.name}
                  />
                ) : (
                  <audio controls src={selected.attachment.data} />
                )}
                <a
                  href={selected.attachment.data}
                  download={selected.attachment.name}
                  className="text-link"
                >
                  下载原始附件 <ArrowDownToLine size={14} />
                </a>
              </div>
            )}
            <div className="ai-box">
              <h3>
                <Sparkles size={16} /> AI 整理
              </h3>
              <p>
                {selected.ai?.summary ||
                  "尚未生成整理结果。AI 接入将在后续阶段完成，原始记录会始终独立保留。"}
              </p>
              {selected.ai && (
                <small>
                  模型：{selected.ai.model} ·{" "}
                  {prettyDate(selected.ai.generatedAt)}
                </small>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function Focus() {
  const { state, update } = useStore();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <SectionTitle
        eyebrow="FOCUS · 现在的关注"
        title="把注意力，留给重要的事"
        text="少一点重点，多一点投入。下一步可以很小。"
        action={
          <button className="button primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> 新建阶段重点
          </button>
        }
      />
      <div className="info-note">
        <Leaf size={18} />
        这里没有效率排名。随时调整重点，留出休息和探索的空间。
      </div>
      <div className="project-grid">
        {state.projects.map((p) => (
          <section key={p.id} className="panel project-card">
            <Tag domain={p.domain} />
            <h2>{p.title}</h2>
            <p>{p.note}</p>
            <div className="goal-connection">
              <Compass size={14} />{" "}
              {state.goals.find((g) => g.id === p.goalId)?.title ||
                "独立探索，暂未关联方向"}
            </div>
            <h4>下一步行动</h4>
            {p.actions.map((a) => (
              <label
                className={`action-row ${a.done ? "done" : ""}`}
                key={a.id}
              >
                <input
                  type="checkbox"
                  checked={a.done}
                  onChange={() =>
                    update((s) => ({
                      ...s,
                      projects: s.projects.map((x) =>
                        x.id === p.id
                          ? {
                              ...x,
                              actions: x.actions.map((y) =>
                                y.id === a.id ? { ...y, done: !y.done } : y,
                              ),
                            }
                          : x,
                      ),
                    }))
                  }
                />
                <span>{a.title}</span>
              </label>
            ))}
            <AddAction projectId={p.id} />
            <div className="project-foot">
              {p.actions.filter((a) => a.done).length} / {p.actions.length}{" "}
              个行动已走过 <span>按自己的节奏</span>
            </div>
          </section>
        ))}
      </div>
      {!state.projects.length && <Empty title="这个阶段，你想关注什么？" />}
      {creating && (
        <CreateModal type="project" onClose={() => setCreating(false)} />
      )}
    </>
  );
}
function AddAction({ projectId }: { projectId: string }) {
  const { update } = useStore();
  const [value, setValue] = useState("");
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        if (
          update((s) => ({
            ...s,
            projects: s.projects.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    actions: [
                      ...p.actions,
                      {
                        id: crypto.randomUUID(),
                        title: value.trim(),
                        done: false,
                      },
                    ],
                  }
                : p,
            ),
          }))
        )
          setValue("");
      }}
    >
      <input
        aria-label="下一步行动"
        placeholder="添加一个小小的下一步…"
        value={value}
        maxLength={200}
        onChange={(e) => setValue(e.target.value)}
        required
      />
      <button className="icon-button" aria-label="添加行动">
        <Plus size={18} />
      </button>
    </form>
  );
}
function Direction() {
  const { state, update } = useStore();
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const pending = state.suggestions.filter((s) => s.status === "pending");
  return (
    <>
      <SectionTitle
        eyebrow="DIRECTION · 未来的方向"
        title="你想走向怎样的生活？"
        text="方向是一枚指南针。它可以清晰，也允许慢慢改变。"
        action={
          <button className="button primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> 添加方向
          </button>
        }
      />
      <div className="direction-list">
        {state.goals.map((g, i) => (
          <section className="direction-card" key={g.id}>
            <span className="direction-index">0{i + 1}</span>
            <div>
              <div className="direction-meta">
                <Tag domain={g.domain} />
                <span>{g.horizon}</span>
              </div>
              <h2>{g.title}</h2>
              <p>{g.why}</p>
              <small>
                {state.projects.filter((p) => p.goalId === g.id).length}{" "}
                个阶段重点与此关联
              </small>
            </div>
            <Compass size={35} strokeWidth={1} />
          </section>
        ))}
      </div>
      {!state.goals.length && <Empty title="先写下一个在意的方向" />}
      <div className="panel suggestions">
        <PanelHead
          title="留给你的思考"
          subtitle="以下为演示建议，未连接 AI。是否调整，由你决定。"
        >
          <Sparkles size={20} />
        </PanelHead>
        {pending.map((s) => (
          <div className="suggestion" key={s.id}>
            <h3>{s.proposedTitle}</h3>
            <p>{s.reason}</p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setConfirm(s.id)}
              >
                查看并确认调整
              </button>
              <button
                className="button ghost"
                onClick={() =>
                  update((st) => decideSuggestion(st, s.id, "dismissed", true))
                }
              >
                保留原方向
              </button>
            </div>
          </div>
        ))}
        {!pending.length && (
          <p className="muted">没有待确认的建议。你的方向由你掌握。</p>
        )}
      </div>
      {creating && (
        <CreateModal type="goal" onClose={() => setCreating(false)} />
      )}
      {confirm && (
        <Modal title="确认调整这个方向？" onClose={() => setConfirm(null)}>
          <p>
            原方向：
            {
              state.goals.find(
                (g) =>
                  g.id ===
                  state.suggestions.find((s) => s.id === confirm)?.goalId,
              )?.title
            }
          </p>
          <p>
            调整为：
            <strong>
              {state.suggestions.find((s) => s.id === confirm)?.proposedTitle}
            </strong>
          </p>
          <p className="muted">确认后只修改该方向的标题，关联项目保持不变。</p>
          <div className="button-row">
            <button
              className="button primary"
              onClick={() => {
                if (
                  update((s) => decideSuggestion(s, confirm, "accepted", true))
                )
                  setConfirm(null);
              }}
            >
              确认修改方向
            </button>
            <button className="button ghost" onClick={() => setConfirm(null)}>
              取消
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Ideas() {
  const { state, update } = useStore();
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const ideas = state.ideas.filter(
    (i) => filter === "all" || i.status === filter,
  );
  return (
    <>
      <SectionTitle
        eyebrow="IDEA GARDEN · 可能性的花园"
        title="让灵感，自由生长"
        text="有些念头会开花，有些适合留在土壤里。它们都不必成为任务。"
        action={
          <button className="button primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> 种下一个灵感
          </button>
        }
      />
      <div className="filter-tabs" role="group" aria-label="灵感状态筛选">
        {[
          ["all", "所有灵感"],
          ...ideaStates.map((s) => [s, ideaLabels[s]]),
        ].map(([v, label]) => (
          <button
            aria-pressed={filter === v}
            key={v}
            className={filter === v ? "selected" : ""}
            onClick={() => setFilter(v)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="idea-grid">
        {ideas.map((i, n) => (
          <article className={`idea-card idea-${n % 3}`} key={i.id}>
            <div className="idea-top">
              <Sprout size={26} strokeWidth={1.3} />
              <Tag domain={i.domain} />
            </div>
            <h2>{i.title}</h2>
            <p>{i.body}</p>
            <div className="idea-bottom">
              <select
                aria-label={`${i.title}的状态`}
                value={i.status}
                onChange={(e) =>
                  update((s) => ({
                    ...s,
                    ideas: s.ideas.map((x) =>
                      x.id === i.id
                        ? { ...x, status: e.target.value as Idea["status"] }
                        : x,
                    ),
                  }))
                }
              >
                {ideaStates.map((s) => (
                  <option key={s} value={s}>
                    {ideaLabels[s]}
                  </option>
                ))}
              </select>
              <span>{prettyDate(i.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
      {!ideas.length && <Empty title="留一片空地，给下一个灵感" />}
      <p className="center-note">
        激活灵感只会改变它的状态，不会自动创建任务。
      </p>
      {creating && (
        <CreateModal type="idea" onClose={() => setCreating(false)} />
      )}
    </>
  );
}
function CreateModal({
  type,
  onClose,
}: {
  type: "idea" | "goal" | "project";
  onClose: () => void;
}) {
  const { state, update } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [domain, setDomain] = useState<Domain>("自我");
  const [horizon, setHorizon] = useState("未来 1 年");
  const [goalId, setGoalId] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const base = {
      id: crypto.randomUUID(),
      title: title.trim(),
      domain,
      createdAt: new Date().toISOString(),
    };
    const ok = update((s) =>
      type === "idea"
        ? {
            ...s,
            ideas: [{ ...base, body: body.trim(), status: "seed" }, ...s.ideas],
          }
        : type === "goal"
          ? {
              ...s,
              goals: [...s.goals, { ...base, why: body.trim(), horizon }],
            }
          : {
              ...s,
              projects: [
                ...s.projects,
                {
                  id: base.id,
                  title: base.title,
                  domain,
                  note: body.trim(),
                  goalId: goalId || null,
                  actions: [],
                },
              ],
            },
    );
    if (ok) onClose();
  }
  return (
    <Modal
      title={
        {
          idea: "种下一个灵感",
          goal: "写下一个未来方向",
          project: "新建阶段重点",
        }[type]
      }
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={submit}>
        <label className="field">
          标题
          <input
            autoFocus
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="用一句话描述它"
          />
        </label>
        <label className="field">
          {type === "goal" ? "为什么对你重要？" : "留下一些想法"}
          <textarea
            required
            rows={4}
            maxLength={10000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <label className="field">
          所属领域
          <DomainSelect value={domain} onChange={setDomain} />
        </label>
        {type === "goal" && (
          <label className="field">
            时间视野
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
            >
              <option>未来 1 年</option>
              <option>未来 1–3 年</option>
              <option>长期方向</option>
            </select>
          </label>
        )}
        {type === "project" && (
          <label className="field">
            关联方向
            <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">独立探索</option>
              {state.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="button-row">
          <button className="button primary">保存</button>
          <button type="button" className="button ghost" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Reflection() {
  const { state, update } = useStore();
  const [cadence, setCadence] = useState<"weekly" | "monthly">("weekly");
  const [wins, setWins] = useState("");
  const [learning, setLearning] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (![wins, learning, next].every((v) => v.trim())) return;
    if (
      update((s) => ({
        ...s,
        reflections: [
          {
            id: crypto.randomUUID(),
            cadence,
            period: `${prettyDate(new Date().toISOString())}的${cadence === "weekly" ? "周" : "月"}度复盘`,
            wins: wins.trim(),
            learning: learning.trim(),
            next: next.trim(),
            createdAt: new Date().toISOString(),
          },
          ...s.reflections,
        ],
      }))
    ) {
      setWins("");
      setLearning("");
      setNext("");
      setMessage("复盘已保存。谢谢你愿意花时间听听自己。");
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="REFLECTION · 和自己聊一聊"
        title="停一停，回望一下"
        text="复盘不只为了做得更好，也为了知道自己过得怎样。"
      />
      <div className="reflection-layout">
        <form className="panel reflection-form" onSubmit={submit}>
          <div className="filter-tabs">
            <button
              type="button"
              className={cadence === "weekly" ? "selected" : ""}
              aria-pressed={cadence === "weekly"}
              onClick={() => setCadence("weekly")}
            >
              周度复盘
            </button>
            <button
              type="button"
              className={cadence === "monthly" ? "selected" : ""}
              aria-pressed={cadence === "monthly"}
              onClick={() => setCadence("monthly")}
            >
              月度复盘
            </button>
          </div>
          <label className="field">
            <span className="question-number">01</span> 这
            {cadence === "weekly" ? "周" : "个月"}，哪些时刻值得被记住？
            <textarea
              required
              maxLength={10000}
              rows={3}
              placeholder="一个进展，一段对话，或一次安静的休息…"
              value={wins}
              onChange={(e) => setWins(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="question-number">02</span>{" "}
            你对自己有了什么新的理解？
            <textarea
              required
              maxLength={10000}
              rows={3}
              placeholder="什么给你能量？什么让你感到消耗？"
              value={learning}
              onChange={(e) => setLearning(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="question-number">03</span>{" "}
            接下来，想给什么多一点空间？
            <textarea
              required
              maxLength={10000}
              rows={3}
              placeholder="可以是一个小行动，也可以是允许自己暂时不做什么。"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <button className="button primary">
            保存这次复盘 <Check size={16} />
          </button>
          {message && (
            <p role="status" className="success-message">
              {message}
            </p>
          )}
        </form>
        <aside className="reflection-aside">
          <BookOpen size={32} strokeWidth={1.3} />
          <h2>
            答案不必漂亮，
            <br />
            真实就很好。
          </h2>
          <p>这里没有评分。你可以诚实地记下犹豫、停顿和那些微小的喜悦。</p>
          <div className="mini-stats">
            <span>
              {state.records.length}
              <small>条生活记录</small>
            </span>
            <span>
              {state.reflections.length}
              <small>次与自己对话</small>
            </span>
          </div>
          <More href="/archive">回看最近的记录</More>
        </aside>
      </div>
      <section className="reflection-history">
        <PanelHead title="走过的路" subtitle="每一次回望，都是新的理解。" />
        {state.reflections.length ? (
          state.reflections.map((r) => (
            <details key={r.id} className="panel reflection-entry">
              <summary>
                {r.period}
                <span>
                  {r.cadence === "weekly" ? "周度" : "月度"} ·{" "}
                  {prettyDate(r.createdAt)}
                </span>
              </summary>
              <h4>值得记住</h4>
              <p className="preserve-lines">{r.wins}</p>
              <h4>新的理解</h4>
              <p className="preserve-lines">{r.learning}</p>
              <h4>下一段路</h4>
              <p className="preserve-lines">{r.next}</p>
            </details>
          ))
        ) : (
          <Empty title="第一次回望，从今天开始" />
        )}
      </section>
    </>
  );
}
function Settings() {
  const { state, replace } = useStore();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<{
    title: string;
    data: AppState;
  } | null>(null);
  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setMessage("文件过大，请选择不超过 6 MB 的备份。");
      return;
    }
    try {
      const data = parseImport(await file.text());
      setPending({
        title: `导入备份，将替换当前全部数据（含 ${data.records.length} 条记录）？`,
        data,
      });
    } catch {
      setMessage(
        "导入失败：文件不是有效的 Personal OS v1 备份。现有数据未变更。",
      );
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="YOUR DATA, YOUR CHOICE"
        title="你的记录，由你掌握"
        text="保留带走数据的自由，也保留重新开始的权利。"
      />
      <div className="settings-grid">
        <section className="panel">
          <PanelHead title="本地数据" />
          <p>
            当前为浏览器本地体验版，首次使用展示示例数据。内容保存在当前浏览器，尚未同步到服务器。清除浏览器数据会删除记录，请定期导出。
          </p>
          <p>
            没有登录和跨设备同步，请在自己的设备上使用。正式账户隔离与
            PostgreSQL 持久化将在下一阶段接入。
          </p>
          <div className="data-counts">
            <span>{state.records.length} 条记录</span>
            <span>{state.ideas.length} 个灵感</span>
            <span>{state.reflections.length} 次复盘</span>
          </div>
          <div className="button-row">
            <button
              className="button primary"
              onClick={() => {
                download(
                  `personal-os-${new Date().toISOString().slice(0, 10)}.json`,
                  exportState(state),
                );
                setMessage(
                  "已生成完整 JSON 备份，包含原始记录、附件和关联数据。",
                );
              }}
            >
              <ArrowDownToLine size={16} /> 导出全部数据
            </button>
            <label className="button secondary file-button">
              <ArrowUpFromLine size={16} /> 导入备份
              <input
                type="file"
                accept="application/json,.json"
                aria-label="导入备份"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <button
            className="text-link raw-backup"
            onClick={() => {
              try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) {
                  setMessage("尚无本地原始备份。");
                  return;
                }
                download("personal-os-raw-backup.json", raw);
                setMessage("已导出浏览器中的原始备份。");
              } catch {
                setMessage("浏览器禁止读取本地存储。");
              }
            }}
          >
            数据读取异常？导出原始备份
          </button>
        </section>
        <section className="panel principles">
          <LockKeyhole size={25} />
          <h2>属于你的私人空间</h2>
          <ul>
            <li>只接收你主动留下的内容</li>
            <li>原始记录与 AI 整理独立保存</li>
            <li>调整目标，始终需要你的确认</li>
            <li>灵感可以长久地只是灵感</li>
            <li>完整导出，保留自己的选择</li>
          </ul>
        </section>
        <section className="panel reset-panel">
          <PanelHead title="重新整理空间" />
          <p>这些操作会替换当前浏览器中的所有内容。建议先导出备份。</p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() =>
                setPending({
                  title: "载入示例内容并替换当前全部数据？",
                  data: seedState(),
                })
              }
            >
              载入示例内容
            </button>
            <button
              className="button danger"
              onClick={() =>
                setPending({
                  title: "清空当前全部数据，开启一个空白空间？",
                  data: emptyState(),
                })
              }
            >
              清空本地数据
            </button>
          </div>
        </section>
      </div>
      {message && (
        <p role="status" className="info-note">
          {message}
        </p>
      )}
      {pending && (
        <Modal title={pending.title} onClose={() => setPending(null)}>
          <p>
            此操作会覆盖当前浏览器中的记录、目标、项目、灵感、复盘和建议。请先导出需要保留的内容。
          </p>
          <div className="button-row">
            <button
              className="button danger"
              onClick={() => {
                if (replace(pending.data)) {
                  setPending(null);
                  setMessage("数据已更新。");
                }
              }}
            >
              确认替换全部数据
            </button>
            <button className="button ghost" onClick={() => setPending(null)}>
              取消
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
