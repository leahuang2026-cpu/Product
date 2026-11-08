import { parseSnapshot, type Snapshot } from "./format";

export type PreviewStatus = "new" | "same" | "conflict" | "unsupported";
export type PreviewRow = {
  id: string;
  kind: "record" | "attachment" | "focus" | "direction" | "reflection";
  status: PreviewStatus;
  reasons: string[];
  inTrash: boolean;
  inactive: boolean;
};
export type PreviewResult = {
  checkedAt: string;
  targetSnapshotAt: string;
  backupSnapshotAt: string;
  blocked: boolean;
  totals: Record<PreviewStatus, number>;
  targetOnly: number;
  rows: PreviewRow[];
};

// Object key order and timezone spelling are not content changes. Array order and
// original whitespace ARE preserved. Runtime sourceVersion is not logical content.
function instant(value: string | null) {
  if (value === null) return null;
  const fraction = /\.(\d+)/.exec(value)?.[1].replace(/0+$/, "") || "";
  return (
    new Date(value).toISOString().slice(0, 19) +
    (fraction ? `.${fraction}` : "") +
    "Z"
  );
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
function logical(row: object) {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key !== "sourceVersion")
      .map(([key, value]) => [
        key,
        key === "createdAt" || key === "deletedAt" ? instant(value) : value,
      ]),
  );
}
// Iterative graph walk, bounded by the schema's row limit; no recursive stack overflow.
function cyclicIds(edges: Map<string, string | null>) {
  const done = new Set<string>(),
    cycles = new Set<string>();
  for (const start of edges.keys()) {
    const path: string[] = [],
      positions = new Map<string, number>();
    let current: string | null = start;
    while (current && edges.has(current) && !done.has(current)) {
      const at = positions.get(current);
      if (at !== undefined) {
        path.slice(at).forEach((id) => cycles.add(id));
        break;
      }
      positions.set(current, path.length);
      path.push(current);
      current = edges.get(current)!;
    }
    path.forEach((id) => done.add(id));
  }
  return cycles;
}
const fieldNames: Record<string, string> = {
  originalText: "原文",
  note: "补充说明",
  domains: "领域或顺序",
  isIdea: "灵感标记",
  links: "链接或顺序",
  attachmentIds: "附件引用或顺序",
  attachments: "原件内容或信息",
  sourceId: "来源关联",
  createdAt: "创建时间",
  deletedAt: "回收站状态或时间",
  kind: "条目类型",
  title: "标题",
  body: "正文",
  next: "下一步",
  relationId: "关联方向",
  sourceIds: "来源材料或顺序",
  active: "启用状态",
  cadence: "复盘周期",
  recordId: "所属记录",
  name: "原件名称",
  mime: "原件格式",
  bytes: "原件大小",
  sha256: "原件校验值",
};

export function previewSnapshots(
  candidate: unknown,
  current: unknown,
  occupiedAttachmentIds: string[] = [],
): PreviewResult {
  function normalized(value: unknown) {
    const s = parseSnapshot(value);
    for (const r of s.records) {
      r.id = r.id.toLowerCase();
      r.sourceId = r.sourceId?.toLowerCase() || null;
      r.attachmentIds = r.attachmentIds.map((id) => id.toLowerCase());
    }
    for (const e of s.entries) {
      e.id = e.id.toLowerCase();
      e.relationId = e.relationId?.toLowerCase() || null;
      e.sourceIds = e.sourceIds.map((id) => id.toLowerCase());
    }
    for (const a of s.attachments) {
      a.id = a.id.toLowerCase();
      a.recordId = a.recordId.toLowerCase();
    }
    return parseSnapshot(s);
  }
  const backup = normalized(candidate),
    target = normalized(current);
  const occupied = new Set(occupiedAttachmentIds.map((id) => id.toLowerCase()));
  const rows: PreviewRow[] = [];
  const targetRecords = new Map(target.records.map((r) => [r.id, r]));
  const targetEntries = new Map(target.entries.map((e) => [e.id, e]));
  const targetAttachments = new Map(target.attachments.map((a) => [a.id, a]));
  const backupAttachments = new Map(backup.attachments.map((a) => [a.id, a]));
  const backupEntries = new Map(backup.entries.map((e) => [e.id, e]));
  const recordCycles = cyclicIds(
    new Map(backup.records.map((r) => [r.id, r.sourceId])),
  );
  const entryCycles = cyclicIds(
    new Map(backup.entries.map((e) => [e.id, e.relationId])),
  );
  function add(
    row: object & { id: string; deletedAt?: string | null; active?: boolean },
    kind: PreviewRow["kind"],
    prior: object | undefined,
    unsupported: string[],
    extra?: [unknown, unknown],
  ) {
    const a = logical(row),
      b = prior ? logical(prior) : undefined;
    const reasons = b
      ? [...new Set([...Object.keys(a), ...Object.keys(b)])]
          .filter((k) => canonical(a[k]) !== canonical(b[k]))
          .map((k) => `${fieldNames[k] || "字段"}不同`)
      : [];
    if (prior && extra && canonical(extra[0]) !== canonical(extra[1]))
      reasons.push("原件内容或信息不同");
    rows.push({
      id: row.id,
      kind,
      status: unsupported.length
        ? "unsupported"
        : !prior
          ? "new"
          : reasons.length
            ? "conflict"
            : "same",
      reasons: [...unsupported, ...reasons],
      inTrash: !!row.deletedAt,
      inactive: kind === "focus" && row.active === false,
    });
  }
  for (const r of backup.records) {
    const prior = targetRecords.get(r.id),
      unsupported: string[] = [];
    if (recordCycles.has(r.id))
      unsupported.push("来源存在自引用或循环，当前恢复方案不支持");
    if (!prior && r.sourceId && targetRecords.get(r.sourceId)?.deletedAt)
      unsupported.push("新增记录引用云端回收站来源，不能绕过原件保护");
    add(r, "record", prior, unsupported, [
      r.attachmentIds.map((id) => backupAttachments.get(id)),
      prior?.attachmentIds.map((id) => targetAttachments.get(id)),
    ]);
  }
  for (const e of backup.entries) {
    const prior = targetEntries.get(e.id),
      unsupported: string[] = [];
    if (entryCycles.has(e.id))
      unsupported.push("方向关联存在自引用或循环，当前恢复方案不支持");
    if (e.kind === "focus" && e.deletedAt)
      unsupported.push("当前数据规则不支持回收站中的关注");
    if (e.relationId && backupEntries.get(e.relationId)?.deletedAt)
      unsupported.push("关联方向在备份回收站中，当前规则不支持该关系");
    if (!prior && e.relationId && targetEntries.get(e.relationId)?.deletedAt)
      unsupported.push("新增条目关联云端回收站方向");
    if (!prior && e.sourceIds.some((id) => targetRecords.get(id)?.deletedAt))
      unsupported.push("新增条目引用云端回收站材料，不能绕过来源保护");
    add(e, e.kind, prior, unsupported);
  }
  for (const a of backup.attachments)
    add(
      a,
      "attachment",
      targetAttachments.get(a.id),
      occupied.has(a.id)
        ? ["同编号的未绑定上传已存在，当前恢复方案需另行核对"]
        : [],
    );
  const totals = { new: 0, same: 0, conflict: 0, unsupported: 0 };
  for (const row of rows) totals[row.status]++;
  const ids = (s: Snapshot) =>
    new Set([
      ...s.records.map((r) => `record:${r.id}`),
      ...s.entries.map((e) => `entry:${e.id}`),
      ...s.attachments.map((a) => `attachment:${a.id}`),
    ]);
  const incoming = ids(backup);
  return {
    checkedAt: new Date().toISOString(),
    targetSnapshotAt: target.snapshotAt,
    backupSnapshotAt: backup.snapshotAt,
    blocked: totals.conflict + totals.unsupported > 0,
    totals,
    targetOnly: [...ids(target)].filter((id) => !incoming.has(id)).length,
    rows,
  };
}
