import { z } from "zod";
import { domainsSchema, linkSchema } from "../os/model";

// Engineering guardrails, not record-creation limits. Fail instead of truncating.
export const LIMITS = {
  zip: 64 * 1024 * 1024,
  originals: 50_000_000,
  file: 10_000_000,
  metadata: 8 * 1024 * 1024,
  rows: 5000,
  attachments: 1000,
  timeout: 120_000,
} as const;
export class BackupError extends Error {}
export function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new BackupError(message);
}
const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const ids = z.array(uuid).max(LIMITS.rows);
const version = z.number().int().positive();
export const recordSchema = z
  .object({
    id: uuid,
    originalText: z.string().max(10000),
    note: z.string().max(10000),
    domains: domainsSchema,
    isIdea: z.boolean(),
    links: z.array(linkSchema),
    attachmentIds: ids,
    sourceId: uuid.nullable(),
    createdAt: timestamp,
    deletedAt: timestamp.nullable(),
    sourceVersion: version,
  })
  .strict();
export const entryBackupSchema = z
  .object({
    id: uuid,
    kind: z.enum(["focus", "direction", "reflection"]),
    title: z.string().max(120),
    body: z.string().max(10000),
    domains: domainsSchema,
    next: z.string().max(200),
    relationId: uuid.nullable(),
    sourceIds: ids,
    active: z.boolean(),
    cadence: z.enum(["weekly", "monthly"]).optional(),
    createdAt: timestamp,
    deletedAt: timestamp.nullable(),
    sourceVersion: version,
  })
  .strict();
export const mimeExtensions = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
} as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const attachmentSchema = z
  .object({
    id: uuid,
    recordId: uuid,
    name: z.string(),
    mime: z.enum([
      "image/png",
      "image/jpeg",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
    ]),
    bytes: z.number().int().positive().max(LIMITS.file),
    sha256: hash,
  })
  .strict();
export const snapshotSchema = z
  .object({
    snapshotAt: timestamp,
    records: z.array(recordSchema).max(LIMITS.rows),
    entries: z.array(entryBackupSchema).max(LIMITS.rows),
    attachments: z.array(attachmentSchema).max(LIMITS.attachments),
  })
  .strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export type BackupAttachment = Snapshot["attachments"][number];
export function originalPath(a: BackupAttachment) {
  return `originals/${a.id}.${mimeExtensions[a.mime]}`;
}
export const encoder = new TextEncoder();
export function jsonBytes(value: unknown) {
  return encoder.encode(JSON.stringify(value));
}
export async function sha256(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function parseSnapshot(value: unknown): Snapshot {
  const result = snapshotSchema.safeParse(value);
  ensure(
    result.success,
    "档案字段不符合当前备份格式，请升级或检查数据；没有省略未知字段。",
  );
  const s = result.data;
  ensure(
    s.records.length + s.entries.length <= LIMITS.rows,
    "条目数量超过本轮备份验证范围，未截断导出。",
  );
  ensure(
    jsonBytes(s).length <= LIMITS.metadata,
    "档案文字与元数据超过本轮备份验证范围。",
  );
  ensure(
    s.attachments.reduce((n, a) => n + a.bytes, 0) <= LIMITS.originals,
    "原件总量超过本轮备份验证范围，未省略原件。",
  );
  const records = new Map(s.records.map((r) => [r.id, r]));
  const entries = new Map(s.entries.map((e) => [e.id, e]));
  const attachments = new Map(s.attachments.map((a) => [a.id, a]));
  ensure(
    records.size === s.records.length &&
      entries.size === s.entries.length &&
      attachments.size === s.attachments.length,
    "备份含重复对象 ID。",
  );
  const bound = new Set<string>();
  for (const r of s.records) {
    ensure(
      !r.sourceId || records.has(r.sourceId),
      "记录来源缺失，无法生成完整备份。",
    );
    ensure(
      new Set(r.attachmentIds).size === r.attachmentIds.length,
      "记录包含重复附件。",
    );
    for (const id of r.attachmentIds) {
      ensure(
        attachments.get(id)?.recordId === r.id && !bound.has(id),
        "原件关联不完整或重复。",
      );
      bound.add(id);
    }
  }
  ensure(bound.size === attachments.size, "附件与记录引用不一致。");
  for (const e of s.entries) {
    ensure(
      e.sourceIds.every((id) => records.has(id)),
      "条目的来源记录缺失。",
    );
    ensure(
      !e.relationId || entries.get(e.relationId)?.kind === "direction",
      "关联方向缺失。",
    );
  }
  return s;
}
export function counts(s: Snapshot) {
  return {
    records: s.records.length,
    trashedRecords: s.records.filter((r) => r.deletedAt).length,
    entries: s.entries.length,
    trashedEntries: s.entries.filter((e) => e.deletedAt).length,
    focus: s.entries.filter((e) => e.kind === "focus").length,
    inactiveFocus: s.entries.filter((e) => e.kind === "focus" && !e.active)
      .length,
    directions: s.entries.filter((e) => e.kind === "direction").length,
    reflections: s.entries.filter((e) => e.kind === "reflection").length,
    attachments: s.attachments.length,
    originalBytes: s.attachments.reduce((n, a) => n + a.bytes, 0),
  };
}
export const scope = "all-saved-including-trash-and-inactive-focus" as const;
export const manifestSchema = z
  .object({
    format: z.literal("personal-os-backup"),
    formatVersion: z.literal(1),
    dataContract: z.literal("reviewed-v2+recycle-bin-v1"),
    id: uuid,
    snapshotAt: timestamp,
    completedAt: timestamp,
    scope: z.literal(scope),
    encrypted: z.literal(false),
    counts: z
      .object({
        records: z.number(),
        trashedRecords: z.number(),
        entries: z.number(),
        trashedEntries: z.number(),
        focus: z.number(),
        inactiveFocus: z.number(),
        directions: z.number(),
        reflections: z.number(),
        attachments: z.number(),
        originalBytes: z.number(),
      })
      .strict(),
    files: z
      .array(
        z
          .object({
            path: z.string(),
            bytes: z.number().int().nonnegative(),
            sha256: hash,
          })
          .strict(),
      )
      .max(LIMITS.attachments + 4),
  })
  .strict();
export type Manifest = z.infer<typeof manifestSchema>;
export type Summary = { snapshotAt: string; counts: ReturnType<typeof counts> };
