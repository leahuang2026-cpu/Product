import { z } from "zod";
export const domains = ["职业", "财富", "能力", "自我", "生活"] as const;
export type Domain = (typeof domains)[number];
export const domainsSchema = z
  .array(z.enum(domains))
  .max(5)
  .refine((v) => new Set(v).size === v.length, "领域不能重复");
export const linkSchema = z
  .string()
  .url()
  .refine((v) => ["https:", "http:"].includes(new URL(v).protocol));
export const createRecordSchema = z
  .object({
    id: z.string().uuid(),
    originalText: z.string().max(10000),
    attachmentIds: z.array(z.string().uuid()),
    links: z.array(linkSchema),
    sourceId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (v) =>
      !!v.originalText.trim() || !!v.attachmentIds.length || !!v.links.length,
    "请写下内容或添加附件。",
  );
export const metadataSchema = z
  .object({
    version: z.number().int().positive(),
    domains: domainsSchema.optional(),
    isIdea: z.boolean().optional(),
    note: z.string().max(10000).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.domains !== undefined || v.isIdea !== undefined || v.note !== undefined,
  );
export type Attachment = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  contentPath: string;
};
export type RecordItem = {
  id: string;
  originalText: string;
  note: string;
  domains: Domain[];
  isIdea: boolean;
  createdAt: string;
  version: number;
  attachments: Attachment[];
  links: string[];
  sourceId?: string | null;
};
export type Entry = {
  id: string;
  kind: "focus" | "direction" | "reflection";
  title: string;
  body: string;
  domains: Domain[];
  next: string;
  relationId: string | null;
  sourceIds: string[];
  active: boolean;
  cadence?: "weekly" | "monthly";
  version: number;
};
export const entrySchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["focus", "direction", "reflection"]),
    title: z.string().max(120),
    body: z.string().max(10000),
    domains: domainsSchema,
    next: z.string().max(200),
    relationId: z.string().uuid().nullable(),
    sourceIds: z.array(z.string().uuid()),
    active: z.boolean(),
    cadence: z.enum(["weekly", "monthly"]).optional(),
    version: z.number().int().nonnegative(),
  })
  .strict()
  .refine((v) => !!(v.title.trim() || v.body.trim()), "请填写你在意的内容。");
export function titleOf(record: RecordItem) {
  return (
    record.originalText
      .split("\n")
      .find((v) => v.trim())
      ?.trim()
      .slice(0, 60) ||
    record.attachments[0]?.name ||
    record.links[0] ||
    "一条记录"
  );
}
export function matchesDomains(
  values: readonly string[],
  selected: readonly string[],
) {
  return !selected.length || selected.some((v) => values.includes(v));
}
export function matchesRecord(
  record: RecordItem,
  query: string,
  selected: readonly string[],
  unclassified = false,
) {
  return (
    matchesDomains(record.domains, selected) &&
    (!unclassified || !record.domains.length) &&
    `${record.originalText}\n${record.note}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
  );
}
export function validateImage(file: { type: string; size: number }) {
  if (!["image/jpeg", "image/png"].includes(file.type))
    return "图片仅支持 JPEG 或 PNG。";
  if (file.size <= 0 || file.size > 10_000_000)
    return "请选择不超过 10 MB 的有效图片。";
  return null;
}

export const trashSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["record", "direction", "reflection"]),
    version: z.number().int().positive(),
    deleted: z.boolean(),
  })
  .strict();
export type TrashItem = {
  id: string;
  kind: "record" | "direction" | "reflection";
  title: string;
  deletedAt: string;
  version: number;
};
