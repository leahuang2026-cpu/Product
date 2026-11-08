import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  recordId,
  attachmentId,
  stamp,
  png,
  collect,
} from "./backup-fixture";
import { previewSnapshots } from "../src/lib/backup/preview";
import {
  readPreviewRequest,
  PREVIEW_BODY_LIMIT,
} from "../src/lib/backup/preview-request";
import { validateBackupDetails } from "../src/lib/backup/validate";
import { exportZip } from "../src/lib/backup/export";
const empty = () => ({
  snapshotAt: stamp,
  records: [],
  entries: [],
  attachments: [],
});

test("BKP-04: new/same/conflict and target-only are accurate; no mutation", async () => {
  const s = await fixture();
  const original = structuredClone(s);
  const first = previewSnapshots(s, empty());
  assert.deepEqual(first.totals, {
    new: 5,
    same: 0,
    conflict: 0,
    unsupported: 0,
  });
  assert.equal(first.rows.find((r) => r.kind === "focus")?.inactive, true);
  assert.equal(first.rows.find((r) => r.kind === "record")?.inTrash, true);
  assert.equal(previewSnapshots(s, s).totals.same, 5);
  const target = structuredClone(s);
  target.records.push({
    ...target.records[0],
    id: crypto.randomUUID(),
    attachmentIds: [],
  });
  assert.equal(previewSnapshots(s, target).targetOnly, 1);
  target.records[0].note = "a changed private note";
  const result = previewSnapshots(s, target);
  assert.equal(result.totals.conflict, 1);
  assert.equal(result.blocked, true);
  assert.ok(!JSON.stringify(result).includes("a changed private note"));
  assert.deepEqual(s, original);
});
test("BKP-04: every logical field conflicts; sourceVersion and equivalent instant do not", async () => {
  const s = await fixture();
  for (const patch of [
    { originalText: "changed" },
    { note: "changed" },
    { domains: ["职业"] },
    { isIdea: false },
    { links: [] },
    { deletedAt: null },
    { createdAt: "2026-11-08T00:00:00.123457Z" },
  ]) {
    const changed = structuredClone(s);
    Object.assign(changed.records[0], patch);
    assert.equal(
      previewSnapshots(s, changed).rows.find((r) => r.kind === "record")
        ?.status,
      "conflict",
    );
  }
  const changed = structuredClone(s);
  changed.records[0].sourceVersion += 10;
  changed.records[0].createdAt = "2026-11-08T08:00:00.123456+08:00";
  assert.equal(previewSnapshots(s, changed).totals.same, 5);
  for (const patch of [
    { body: "changed" },
    { cadence: "weekly" },
    { sourceIds: [] },
    { deletedAt: null },
  ]) {
    const altered = structuredClone(s);
    Object.assign(altered.entries[2], patch);
    assert.equal(
      previewSnapshots(s, altered).rows.find((r) => r.kind === "reflection")
        ?.status,
      "conflict",
    );
  }
});
test("BKP-04: attachment bytes/hash/name/order and changed entry kinds cannot silently skip", async () => {
  const s = await fixture(),
    target = structuredClone(s);
  target.attachments[0].sha256 = "0".repeat(64);
  const diff = previewSnapshots(s, target);
  assert.equal(diff.totals.conflict, 2);
  assert.equal(diff.rows.find((r) => r.kind === "record")?.status, "conflict");
  target.attachments[0].sha256 = s.attachments[0].sha256;
  target.entries[2].kind = "direction";
  assert.equal(
    previewSnapshots(s, target).rows.find((r) => r.id === s.entries[2].id)
      ?.status,
    "conflict",
  );
  const multi = structuredClone(s);
  multi.attachments.push({ ...multi.attachments[0], id: crypto.randomUUID() });
  multi.records[0].attachmentIds.push(multi.attachments[1].id);
  const order = structuredClone(multi);
  order.records[0].attachmentIds.reverse();
  assert.equal(previewSnapshots(multi, order).rows[0].status, "conflict");
});
test("BKP-04: cycle/self references, focus trash and existing removed sources block the batch", async () => {
  const s = await fixture();
  s.records[0].sourceId = recordId;
  assert.equal(previewSnapshots(s, empty()).totals.unsupported, 1);
  s.records[0].sourceId = null;
  const id = crypto.randomUUID();
  s.records.push({
    ...s.records[0],
    id,
    attachmentIds: [],
    sourceId: recordId,
  });
  s.records[0].sourceId = id;
  assert.equal(previewSnapshots(s, empty()).totals.unsupported, 2);
  s.records[0].sourceId = null;
  s.records[1].sourceId = recordId;
  const target = await fixture();
  assert.equal(
    previewSnapshots(s, target).rows.find((r) => r.id === id)?.status,
    "unsupported",
  );
  const focus = structuredClone(target);
  focus.entries[1].deletedAt = stamp;
  assert.equal(
    previewSnapshots(focus, empty()).rows.find((r) => r.kind === "focus")
      ?.status,
    "unsupported",
  );
  const dir = structuredClone(target);
  dir.entries[0].deletedAt = stamp;
  assert.equal(
    previewSnapshots(dir, empty()).rows.find((r) => r.kind === "focus")?.status,
    "unsupported",
  );
});
test("BKP-04: new review referencing existing trash, and an unbound original collision, stop", async () => {
  const s = await fixture(),
    target = structuredClone(s);
  target.entries = target.entries.filter((e) => e.kind !== "reflection");
  assert.equal(
    previewSnapshots(s, target).rows.find((r) => r.kind === "reflection")
      ?.status,
    "unsupported",
  );
  assert.equal(
    previewSnapshots(s, empty(), [attachmentId]).rows.find(
      (r) => r.kind === "attachment",
    )?.status,
    "unsupported",
  );
  const invalid = structuredClone(s);
  invalid.records[0].sourceId = crypto.randomUUID();
  assert.throws(() => previewSnapshots(invalid, target), /来源/);
});
test("BKP-04: large source chain is bounded and uses no recursion", async () => {
  const s = empty() as Awaited<ReturnType<typeof fixture>>;
  const base = (await fixture()).records[0];
  for (let i = 0; i < 5000; i++)
    s.records.push({
      ...base,
      id: crypto.randomUUID(),
      sourceId: i ? s.records[i - 1].id : null,
      attachmentIds: [],
    });
  assert.equal(previewSnapshots(s, empty()).totals.new, 5000);
});
test("BKP-04: validated ZIP exposes exact metadata only after original hashes pass", async () => {
  const s = await fixture();
  const zip = await collect(exportZip(s, async () => png));
  const result = await validateBackupDetails(zip);
  assert.deepEqual(result.snapshot, s);
  const request = new Request("http://localhost/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formatVersion: 1, snapshot: result.snapshot }),
  });
  assert.deepEqual(await readPreviewRequest(request), s);
  const packet = JSON.stringify({
    formatVersion: 1,
    snapshot: result.snapshot,
  });
  assert.ok(!packet.includes(png.toString("base64")));
  assert.ok(!packet.includes("owner_id"));
  assert.ok(!packet.includes("object_key"));
});
test("BKP-04: unknown/enriched envelopes, oversized streams, bad JSON and ZIP uploads are rejected", async () => {
  const s = await fixture();
  const req = (
    body: string,
    headers: Record<string, string> = { "Content-Type": "application/json" },
  ) =>
    new Request("http://localhost/preview", { method: "POST", headers, body });
  await assert.rejects(
    readPreviewRequest(
      req(
        JSON.stringify({ formatVersion: 1, snapshot: s, owner_id: "forged" }),
      ),
    ),
  );
  await assert.rejects(readPreviewRequest(req("broken")));
  await assert.rejects(
    readPreviewRequest(req("{}", { "Content-Type": "application/zip" })),
  );
  await assert.rejects(
    readPreviewRequest(
      req("{}", {
        "Content-Type": "application/json",
        "Content-Length": String(PREVIEW_BODY_LIMIT + 1),
      }),
    ),
  );
  await assert.rejects(
    readPreviewRequest(req(" ".repeat(PREVIEW_BODY_LIMIT + 1))),
  );
});
