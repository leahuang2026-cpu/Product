import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideSuggestion,
  exportState,
  filterRecords,
  parseImport,
  recordSchema,
  safeUrl,
} from "../src/lib/domain";
import { seedState } from "../src/lib/seed";

test("原始文本保留空白和换行，纯空白输入被拒绝", () => {
  const original = "  这里有原始空白。\n第二行。\n";
  const record = seedState().records[0];
  assert.equal(recordSchema.parse({ ...record, raw: original }).raw, original);
  assert.equal(
    recordSchema.safeParse({ ...record, raw: " \n " }).success,
    false,
  );
});

test("完整备份往返保留原文、关联和建议状态", () => {
  const state = seedState();
  assert.deepEqual(parseImport(exportState(state)), state);
});
test("目标建议未经确认不能改变目标；确认也不改写原始记录", () => {
  const original = seedState();
  assert.throws(() => decideSuggestion(original, "s1", "accepted", false));
  const updated = decideSuggestion(original, "s1", "accepted", true);
  assert.equal(updated.goals[0].title, original.suggestions[0].proposedTitle);
  assert.equal(original.goals[0].title, "成为能独立创造产品的人");
  assert.deepEqual(updated.records, original.records);
  assert.equal(updated.suggestions[0].status, "accepted");
  assert.ok(updated.suggestions[0].decidedAt);
  assert.throws(() => decideSuggestion(updated, "s1", "accepted", true));
});
test("拒绝建议保留原方向", () => {
  const state = seedState();
  assert.deepEqual(
    decideSuggestion(state, "s1", "dismissed", true).goals,
    state.goals,
  );
});
test("按领域与原文、标题、标签共同筛选", () => {
  const { records } = seedState();
  assert.equal(filterRecords(records, "慢下来", "自我").length, 1);
  assert.equal(filterRecords(records, "慢下来", "财富").length, 0);
  assert.equal(filterRecords(records, "", "全部").length, 3);
  assert.equal(filterRecords(records, "手机", "生活")[0].id, "r3");
});
test("导入拒绝未知版本、孤立关联和重复标识", () => {
  assert.throws(() => parseImport('{"version":2}'));
  const state = seedState();
  state.projects[0].goalId = "missing";
  assert.throws(() => parseImport(JSON.stringify(state)));
  const duplicate = seedState();
  duplicate.records.push(duplicate.records[0]);
  assert.throws(() => parseImport(JSON.stringify(duplicate)));
});
test("链接不允许脚本与 data 协议；媒体附件需要有效数据和 MIME", () => {
  assert.equal(safeUrl.safeParse("javascript:alert(1)").success, false);
  assert.equal(safeUrl.safeParse("data:text/html,hello").success, false);
  assert.equal(safeUrl.safeParse("https://example.com").success, true);
  const record = seedState().records[0];
  assert.equal(
    recordSchema.safeParse({ ...record, kind: "image" }).success,
    false,
  );
  assert.equal(
    recordSchema.safeParse({
      ...record,
      kind: "audio",
      attachment: {
        name: "a.png",
        mime: "image/png",
        data: "data:image/png;base64,YQ==",
      },
    }).success,
    false,
  );
  assert.equal(
    recordSchema.safeParse({
      ...record,
      kind: "image",
      attachment: {
        name: "a.png",
        mime: "image/png",
        data: "data:text/html;base64,YQ==",
      },
    }).success,
    false,
  );
});
