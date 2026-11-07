import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRecordSchema,
  trashSchema,
  metadataSchema,
  matchesRecord,
  validateImage,
  type RecordItem,
} from "../src/lib/os/model";
import { sameOrigin, isOwner, safeImagePath } from "../src/lib/server/security";
const record: RecordItem = {
  id: "11111111-1111-4111-8111-111111111111",
  originalText: "  数据库学习\n思考  ",
  note: "绿色卡片",
  domains: ["职业", "能力"],
  isIdea: false,
  createdAt: "2026-11-06T00:00:00Z",
  version: 1,
  attachments: [],
  links: [],
};
test("统一记录允许原文或附件，保持原文；拒绝空记录和额外 owner 字段", () => {
  const input = {
    id: record.id,
    originalText: record.originalText,
    attachmentIds: [],
    links: [],
  };
  assert.equal(
    createRecordSchema.parse(input).originalText,
    record.originalText,
  );
  assert.equal(
    createRecordSchema.safeParse({ ...input, originalText: " \n " }).success,
    false,
  );
  assert.equal(
    createRecordSchema.safeParse({
      ...input,
      originalText: "",
      attachmentIds: [record.id],
    }).success,
    true,
  );
  assert.equal(
    createRecordSchema.safeParse({ ...input, ownerId: record.id }).success,
    false,
  );
});
test("链接只接受 HTTP(S)，同一条可同时包含附件和链接", () => {
  assert.equal(
    createRecordSchema.safeParse({
      id: record.id,
      originalText: "",
      attachmentIds: [record.id],
      links: ["https://example.com"],
    }).success,
    true,
  );
  assert.equal(
    createRecordSchema.safeParse({
      id: record.id,
      originalText: "",
      attachmentIds: [],
      links: ["javascript:alert(1)"],
    }).success,
    false,
  );
});
test("多领域任一匹配、正文说明查询、未分类与清除条件", () => {
  assert.equal(matchesRecord(record, "数据库", ["生活", "能力"]), true);
  assert.equal(matchesRecord(record, "绿色", ["职业"]), true);
  assert.equal(matchesRecord(record, "", [], true), false);
  assert.equal(matchesRecord({ ...record, domains: [] }, "", [], true), true);
  assert.equal(matchesRecord(record, "%", []), false);
});
test("元数据更新不能覆盖原件，领域不可重复", () => {
  assert.equal(
    metadataSchema.safeParse({
      version: 1,
      domains: ["职业", "能力"],
      isIdea: true,
    }).success,
    true,
  );
  assert.equal(
    metadataSchema.safeParse({ version: 1, originalText: "覆盖" }).success,
    false,
  );
  assert.equal(
    metadataSchema.safeParse({ version: 1, domains: ["职业", "职业"] }).success,
    false,
  );
  assert.equal(
    metadataSchema.safeParse({ version: 1, domains: [] }).success,
    true,
  );
});
test("图片字节上限和格式一致", () => {
  assert.equal(validateImage({ type: "image/png", size: 10_000_000 }), null);
  assert.ok(validateImage({ type: "image/png", size: 10_000_001 }));
  assert.ok(validateImage({ type: "image/webp", size: 100 }));
  assert.ok(validateImage({ type: "image/png", size: 0 }));
});
test("私有请求来源与身份默认拒绝，附件不能指向外部", () => {
  assert.equal(
    sameOrigin(
      new Request("https://os.test/api", {
        headers: { origin: "https://evil.test" },
      }),
    ),
    false,
  );
  assert.equal(sameOrigin(new Request("https://os.test/api")), false);
  assert.equal(
    sameOrigin(
      new Request("https://os.test/api", {
        headers: { origin: "https://os.test" },
      }),
    ),
    true,
  );
  assert.equal(isOwner(undefined, undefined), false);
  assert.equal(isOwner("a", "b"), false);
  assert.equal(isOwner("a", "a"), true);
  assert.equal(safeImagePath("https://external.test/image"), false);
  assert.equal(safeImagePath("/api/attachments/123/content"), true);
});

test("回收站仅允许原记录、方向和复盘，拒绝永久删除、伪造归属与失效版本", () => {
  const valid = { id: record.id, kind: "record", version: 1, deleted: true };
  assert.equal(trashSchema.safeParse(valid).success, true);
  assert.equal(
    trashSchema.safeParse({ ...valid, deleted: false }).success,
    true,
  );
  for (const extra of [
    { kind: "focus" },
    { version: 0 },
    { permanent: true },
    { owner_id: "fake" },
    { deleted: "yes" },
  ])
    assert.equal(trashSchema.safeParse({ ...valid, ...extra }).success, false);
});
