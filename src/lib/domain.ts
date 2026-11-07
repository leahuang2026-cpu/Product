import { z } from "zod";

export const domains = ["职业", "财富", "能力", "自我", "生活"] as const;
export const domainSchema = z.enum(domains);
export type Domain = z.infer<typeof domainSchema>;
export const ideaStates = ["seed", "exploring", "paused", "active"] as const;
export const ideaLabels = {
  seed: "种子",
  exploring: "探索中",
  paused: "暂时休眠",
  active: "已激活",
};
const id = z.string().min(1).max(100);
const date = z.string().datetime();
const text = z.string().trim().min(1).max(10000);
export const safeUrl = z
  .string()
  .url()
  .refine(
    (v) => ["https:", "http:"].includes(new URL(v).protocol),
    "请输入 http 或 https 链接",
  );
export const attachmentSchema = z
  .object({
    name: z.string().min(1).max(255),
    mime: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
    ]),
    data: z.string().max(1_500_000),
  })
  .superRefine((v, ctx) => {
    if (
      !v.data.startsWith(`data:${v.mime};base64,`) ||
      !/^data:[\w/+.-]+;base64,[A-Za-z0-9+/]*={0,2}$/.test(v.data)
    )
      ctx.addIssue({ code: "custom", message: "附件格式无效" });
  });
export const recordSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(120),
    raw: z
      .string()
      .min(1)
      .max(10000)
      .refine((value) => value.trim().length > 0, "记录不能为空"),
    domain: domainSchema,
    kind: z.enum(["text", "link", "image", "audio"]),
    url: safeUrl.optional(),
    attachment: attachmentSchema.optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10),
    createdAt: date,
    ai: z
      .object({ summary: text, model: z.string(), generatedAt: date })
      .nullable(),
  })
  .superRefine((r, ctx) => {
    if (r.kind === "link" && !r.url)
      ctx.addIssue({ code: "custom", message: "链接记录缺少 URL" });
    if (
      (r.kind === "image" || r.kind === "audio") &&
      (!r.attachment || !r.attachment.mime.startsWith(r.kind + "/"))
    )
      ctx.addIssue({ code: "custom", message: "附件类型不匹配" });
  });
export const goalSchema = z.object({
  id,
  title: z.string().trim().min(1).max(120),
  why: text,
  domain: domainSchema,
  horizon: z.string().min(1).max(100),
  createdAt: date,
});
export const projectSchema = z.object({
  id,
  goalId: id.nullable(),
  title: z.string().min(1).max(120),
  domain: domainSchema,
  note: text,
  actions: z
    .array(
      z.object({ id, title: z.string().min(1).max(200), done: z.boolean() }),
    )
    .max(100),
});
export const ideaSchema = z.object({
  id,
  title: z.string().trim().min(1).max(120),
  body: text,
  domain: domainSchema,
  status: z.enum(ideaStates),
  createdAt: date,
});
export const reflectionSchema = z.object({
  id,
  cadence: z.enum(["weekly", "monthly"]),
  period: z.string().min(1).max(100),
  wins: text,
  learning: text,
  next: text,
  createdAt: date,
});
export const suggestionSchema = z.object({
  id,
  goalId: id,
  proposedTitle: z.string().min(1).max(120),
  reason: text,
  status: z.enum(["pending", "accepted", "dismissed"]),
  decidedAt: date.nullable(),
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    records: z.array(recordSchema).max(1000),
    goals: z.array(goalSchema).max(100),
    projects: z.array(projectSchema).max(100),
    ideas: z.array(ideaSchema).max(1000),
    reflections: z.array(reflectionSchema).max(1000),
    suggestions: z.array(suggestionSchema).max(100),
  })
  .superRefine((s, ctx) => {
    for (const items of [
      s.records,
      s.goals,
      s.projects,
      s.ideas,
      s.reflections,
      s.suggestions,
    ]) {
      if (new Set(items.map((x) => x.id)).size !== items.length)
        ctx.addIssue({ code: "custom", message: "数据包含重复 ID" });
    }
    for (const p of s.projects)
      if (p.goalId && !s.goals.some((g) => g.id === p.goalId))
        ctx.addIssue({ code: "custom", message: "项目目标关联无效" });
    for (const p of s.suggestions)
      if (!s.goals.some((g) => g.id === p.goalId))
        ctx.addIssue({ code: "custom", message: "建议目标关联无效" });
  });
export type AppState = z.infer<typeof stateSchema>;
export type CaptureRecord = z.infer<typeof recordSchema>;
export type Idea = z.infer<typeof ideaSchema>;
export type Goal = z.infer<typeof goalSchema>;
export const STORAGE_KEY = "personal-os:v1";
export function emptyState(): AppState {
  return {
    version: 1,
    records: [],
    goals: [],
    projects: [],
    ideas: [],
    reflections: [],
    suggestions: [],
  };
}
export function parseImport(json: string): AppState {
  return stateSchema.parse(JSON.parse(json));
}
export function exportState(state: AppState): string {
  return JSON.stringify(stateSchema.parse(state), null, 2);
}
export function decideSuggestion(
  state: AppState,
  suggestionId: string,
  decision: "accepted" | "dismissed",
  confirmed: boolean,
): AppState {
  if (!confirmed) throw new Error("目标变更需要用户确认");
  const s = state.suggestions.find((x) => x.id === suggestionId);
  if (!s || s.status !== "pending") throw new Error("建议不存在或已处理");
  return {
    ...state,
    goals: state.goals.map((g) =>
      g.id === s.goalId && decision === "accepted"
        ? { ...g, title: s.proposedTitle }
        : g,
    ),
    suggestions: state.suggestions.map((x) =>
      x.id === s.id
        ? { ...x, status: decision, decidedAt: new Date().toISOString() }
        : x,
    ),
  };
}
export function filterRecords(
  records: CaptureRecord[],
  query: string,
  domain: string,
): CaptureRecord[] {
  const q = query.trim().toLocaleLowerCase();
  return records.filter(
    (r) =>
      (domain === "全部" || r.domain === domain) &&
      `${r.title} ${r.raw} ${r.tags.join(" ")}`.toLocaleLowerCase().includes(q),
  );
}
export function prettyDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
