"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Mic, Link2, Square, X, ArrowUp } from "lucide-react";
import { request, RequestError } from "@/lib/os/client";
import {
  linkSchema,
  validateImage,
  type RecordItem,
  type Domain,
} from "@/lib/os/model";
import { useOS } from "./context";
import { DomainPicker, Notice } from "./common";
type DraftFile = { id: string; file: File; uploaded?: string };
function Preview({ file }: { file: File }) {
  const [url, setURL] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(file);
    queueMicrotask(() => setURL(value));
    return () => URL.revokeObjectURL(value);
  }, [file]);
  if (!url) return <span>正在准备预览…</span>;
  return file.type.startsWith("image/") ? (
    <Image
      unoptimized
      width={1200}
      height={800}
      className="draft-image"
      src={url}
      alt={file.name}
    />
  ) : (
    <audio controls src={url} aria-label={file.name} />
  );
}
export function Composer({
  onDone,
  sourceId,
}: {
  onDone?: () => void;
  sourceId?: string;
}) {
  const { setDirty, reload } = useOS();
  const [text, setText] = useState(""),
    [files, setFiles] = useState<DraftFile[]>([]),
    [links, setLinks] = useState<string[]>([]),
    [url, setURL] = useState(""),
    [showURL, setShowURL] = useState(false),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [starting, setStarting] = useState(false),
    [error, setError] = useState(""),
    [stage, setStage] = useState(""),
    [saved, setSaved] = useState<RecordItem | null>(null),
    [selected, setSelected] = useState<Domain[]>([]),
    [feedback, setFeedback] = useState(""),
    [sealed, setSealed] = useState(false);
  const metadataRequest = useRef<{ body: string; key: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    alive = useRef(true),
    id = useRef<string | null>(null);
  useEffect(() => {
    setDirty(
      !saved &&
        (!!text || files.length > 0 || links.length > 0 || !!url || recording),
    );
  }, [text, files, links, url, recording, saved, setDirty]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError("");
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error("此浏览器不支持录音，请使用支持录音的安全页面。");
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const r = new MediaRecorder(s);
      recorder.current = r;
      const parts: BlobPart[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        if (!alive.current) return;
        const file = new File(
          parts,
          `录音-${Date.now()}.${r.mimeType.includes("mp4") ? "m4a" : "webm"}`,
          { type: r.mimeType },
        );
        setFiles((v) => [...v, { id: crypto.randomUUID(), file }]);
        setRecording(false);
      };
      r.onerror = () => {
        setError("录音失败，请检查麦克风后重试。");
        s.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      r.start();
      setRecording(true);
    } catch (e) {
      setError(
        (e as Error).name === "NotAllowedError"
          ? "麦克风权限未开放，文字与图片仍可继续记录。"
          : (e as Error).message,
      );
    } finally {
      setStarting(false);
    }
  }
  async function selectFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    for (const file of Array.from(list)) {
      const issue = validateImage(file);
      if (issue) {
        setError(issue);
        continue;
      }
      try {
        const bitmap = await createImageBitmap(file);
        bitmap.close();
        setFiles((v) => [...v, { id: crypto.randomUUID(), file }]);
      } catch {
        setError("这张图片无法读取，请选择有效的 JPEG 或 PNG。");
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  function addLink() {
    if (!linkSchema.safeParse(url.trim()).success) {
      setError("请填写有效的 http 或 https 链接。");
      return;
    }
    setLinks((v) => [...v, url.trim()]);
    setURL("");
    setShowURL(false);
    setError("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || recording || starting) return;
    if (url.trim()) {
      setError("请先添加链接，或清空链接输入。");
      return;
    }
    if (!text.trim() && !files.length && !links.length) {
      setError("请写下内容或添加附件。");
      return;
    }
    setBusy(true);
    setError("");
    id.current ??= crypto.randomUUID();
    try {
      const attachmentIds: string[] = [];
      for (const draft of files) {
        if (draft.uploaded) {
          attachmentIds.push(draft.uploaded);
          continue;
        }
        setStage(`正在上传 ${draft.file.name}`);
        const body = new FormData();
        body.set("id", draft.id);
        body.set("file", draft.file);
        const item = await request<{ id: string }>("/api/uploads", {
          method: "POST",
          body,
        });
        attachmentIds.push(item.id);
        setFiles((v) =>
          v.map((f) => (f.id === draft.id ? { ...f, uploaded: item.id } : f)),
        );
      }
      setSealed(true);
      setStage("正在保存记录");
      const item = await request<RecordItem>("/api/records", {
        method: "POST",
        body: JSON.stringify({
          id: id.current,
          originalText: text,
          attachmentIds,
          links,
          ...(sourceId ? { sourceId } : {}),
        }),
      });
      setSaved(item);
      setSelected(item.domains);
      setDirty(false);
      reload();
    } catch (e) {
      setError((e as Error).message);
      if (
        e instanceof RequestError &&
        [
          "NOT_CONFIGURED",
          "DATA_NOT_READY",
          "LOGIN_REQUIRED",
          "INVALID_RECORD",
        ].includes(e.code)
      )
        setSealed(false);
    } finally {
      setBusy(false);
      setStage("");
    }
  }
  async function metadata(kind: "domain" | "idea") {
    if (!saved) return;
    setBusy(true);
    setError("");
    const body = JSON.stringify(
      kind === "domain"
        ? { version: saved.version, domains: selected }
        : { version: saved.version, isIdea: !saved.isIdea },
    );
    if (metadataRequest.current?.body !== body)
      metadataRequest.current = { body, key: crypto.randomUUID() };
    try {
      const item = await request<RecordItem>(`/api/records/${saved.id}`, {
        method: "PATCH",
        headers: { "Idempotency-Key": metadataRequest.current.key },
        body,
      });
      metadataRequest.current = null;
      setSaved(item);
      setFeedback(
        kind === "domain"
          ? "领域已保存。"
          : item.isIdea
            ? "已留在灵感库。"
            : "已取消灵感标记，原文仍在档案中。",
      );
      reload();
    } catch (e) {
      setError(`原文已保存；${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setText("");
    setFiles([]);
    setLinks([]);
    setSaved(null);
    setSelected([]);
    setSealed(false);
    id.current = null;
    setFeedback("");
    setError("");
    setURL("");
  }
  if (saved)
    return (
      <section className="capture-result">
        <div className="saved-heading">
          <span className="eyebrow">✓ SAVED / 已保存</span>
          <h2>已经留下了。</h2>
          <p className="success" role="status">
            内容已保存，可稍后整理。
          </p>
        </div>
        <h3>为它补充一些线索？</h3>
        <p className="subtle-note">领域可多选，也可以稍后再说。</p>
        <DomainPicker
          value={selected}
          onChange={setSelected}
          label="为这条记录补充领域"
          disabled={busy}
        />
        <div className="button-row">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void metadata("domain")}
          >
            保存领域
          </button>
          <button
            type="button"
            className="button quiet"
            disabled={busy}
            onClick={() => void metadata("idea")}
          >
            {saved.isIdea ? "取消灵感标记" : "留在灵感库"}
          </button>
        </div>
        {feedback && <p role="status">{feedback}</p>}
        {error && <Notice error={error} />}
        <div className="button-row">
          <a className="button quiet" href={`/archive/${saved.id}`}>
            查看记录
          </a>
          <button
            className="button quiet"
            onClick={() => {
              reset();
              onDone?.();
            }}
          >
            跳过，稍后整理
          </button>
          <button className="button primary" onClick={reset}>
            继续记录
          </button>
        </div>
      </section>
    );
  return (
    <form className="composer" onSubmit={submit}>
      {sourceId && (
        <p className="subtle-note">
          这次手写补充会引用来源记录，原文保持原样。
        </p>
      )}
      <label className="sr-only" htmlFor="capture-text">
        记录内容
      </label>
      <textarea
        id="capture-text"
        placeholder="此刻有什么值得留下？写一句话，或添加一张图片…"
        value={text}
        maxLength={10000}
        disabled={busy || sealed}
        onChange={(e) => setText(e.target.value)}
        rows={4}
      />
      <div className="draft-files">
        {files.map((f) => (
          <div className="draft-file" key={f.id}>
            <Preview file={f.file} />
            <span>{f.file.name}</span>
            <button
              className="icon-button"
              type="button"
              aria-label={`移除 ${f.file.name}`}
              disabled={busy || sealed}
              onClick={() => setFiles((v) => v.filter((x) => x.id !== f.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      {links.map((l, i) => (
        <div className="draft-link" key={`${l}-${i}`}>
          <Link2 size={16} />
          <span>{l}</span>
          <button
            type="button"
            className="icon-button"
            aria-label={`移除链接 ${i + 1}`}
            disabled={busy || sealed}
            onClick={() => setLinks((v) => v.filter((_, n) => n !== i))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      {showURL && (
        <div className="link-input">
          <label>
            链接地址
            <input
              type="url"
              value={url}
              disabled={busy || sealed}
              onChange={(e) => setURL(e.target.value)}
              placeholder="https://"
            />
          </label>
          <button
            type="button"
            className="button quiet"
            onClick={addLink}
            disabled={busy || sealed}
          >
            添加链接
          </button>
        </div>
      )}
      <div className="composer-bottom">
        <div className="capture-tools">
          <button
            type="button"
            disabled={busy || sealed || starting}
            onClick={() => void record()}
            aria-label={recording ? "停止录音" : "录制语音"}
            className={`icon-button ${recording ? "recording" : ""}`}
          >
            {recording ? <Square size={19} /> : <Mic size={19} />}
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="添加图片"
            disabled={busy || sealed}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={20} />
            <span className="tool-label">图片</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/jpeg,image/png"
            className="sr-only"
            tabIndex={-1}
            aria-label="图片文件"
            onChange={(e) => void selectFiles(e.target.files)}
          />
          <button
            className="icon-button"
            type="button"
            aria-label="添加链接"
            disabled={busy || sealed}
            onClick={() => setShowURL(true)}
          >
            <Link2 size={20} />
          </button>
        </div>
        <button
          className="button primary"
          disabled={busy || recording || starting}
        >
          {busy ? "保存中…" : sealed ? "重试保存" : "保存"}
          <ArrowUp size={17} />
        </button>
      </div>
      {recording && <p role="status">正在录音，停止后可保存原始录音。</p>}
      {stage && <p role="status">{stage}</p>}
      {error && <Notice error={error} />}
      <p className="composer-note">
        先留下来。保存后，再决定领域或是否留作灵感。
      </p>
    </form>
  );
}
