import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { exportZip } from "../src/lib/backup/export";
import {
  LIMITS,
  originalPath,
  parseSnapshot,
  sha256,
} from "../src/lib/backup/format";
import { readStoredZip, validateBackup } from "../src/lib/backup/validate";
import { collect, fixture, png, stamp } from "./backup-fixture";
const empty = { snapshotAt: stamp, records: [], entries: [], attachments: [] };
async function pack() {
  return collect(exportZip(await fixture(), async () => png));
}

test("BKP: empty archive and full snapshot preserve originals, relations, trash, cadence, microseconds", async () => {
  const zero = await collect(
    exportZip(empty, async () => {
      throw Error("unexpected");
    }),
  );
  assert.equal((await validateBackup(zero)).counts.records, 0);
  const bytes = await pack(),
    s = await fixture();
  const result = await validateBackup(bytes),
    files = readStoredZip(bytes);
  assert.equal(result.counts.trashedRecords, 1);
  assert.equal(result.counts.trashedEntries, 1);
  assert.equal(result.counts.inactiveFocus, 1);
  assert.deepEqual(
    JSON.parse(new TextDecoder().decode(files.get("records.json"))),
    s.records,
  );
  assert.deepEqual(
    JSON.parse(new TextDecoder().decode(files.get("entries.json"))),
    s.entries,
  );
  assert.deepEqual(
    files.get(originalPath(s.attachments[0])),
    new Uint8Array(png),
  );
  assert.equal(result.snapshotAt, stamp);
  assert.equal(Object.keys(unzipSync(bytes)).length, 6); // independent library read
  assert.ok(
    !new TextDecoder().decode(files.get("manifest.json")).includes("owner_id"),
  );
});
test("BKP: incomplete, corrupt and missing originals never finish a backup", async () => {
  await assert.rejects(
    collect(exportZip(await fixture(), async () => new Uint8Array(png.length))),
    /完整性/,
  );
  await assert.rejects(
    collect(
      exportZip(await fixture(), async () => {
        throw Error("unavailable");
      }),
    ),
    /unavailable/,
  );
  const bytes = await pack();
  await assert.rejects(validateBackup(bytes.subarray(0, bytes.length - 22)));
  const bad = bytes.slice();
  bad[100] ^= 1;
  await assert.rejects(validateBackup(bad));
});
test("BKP: reject unknown fields, dangling sources, duplicate IDs, oversized and incorrect binding before export", async () => {
  const s = await fixture();
  assert.throws(() => parseSnapshot({ ...s, owner_id: "forged" }));
  assert.throws(() =>
    parseSnapshot({ ...s, records: [...s.records, s.records[0]] }),
  );
  assert.throws(() => parseSnapshot({ ...s, attachments: [] }));
  assert.throws(() =>
    parseSnapshot({
      ...s,
      records: [{ ...s.records[0], sourceId: crypto.randomUUID() }],
    }),
  );
  assert.throws(() =>
    parseSnapshot({
      ...s,
      attachments: [{ ...s.attachments[0], bytes: LIMITS.file + 1 }],
    }),
  );
  assert.throws(() =>
    parseSnapshot({ ...s, entries: [{ ...s.entries[0], futureField: true }] }),
  );
});
test("BKP: reject re-compressed/encrypted/symlink/path traversal/multi-disk/oversized ZIP", async () => {
  const bytes = await pack(),
    files = unzipSync(bytes);
  await assert.rejects(validateBackup(zipSync(files, { level: 6 })));
  await assert.rejects(
    validateBackup(
      zipSync({ ...files, "../secret": strToU8("bad") }, { level: 0 }),
    ),
  );
  await assert.rejects(
    validateBackup(
      zipSync(
        {
          ...files,
          "originals/symlink": [strToU8("bad"), { attrs: 0xa1ff0000 }],
        },
        { level: 0 },
      ),
    ),
  );
  const multi = bytes.slice();
  multi[multi.length - 18] = 1;
  await assert.rejects(validateBackup(multi));
  await assert.rejects(validateBackup(new Uint8Array(LIMITS.zip + 1)));
  const encrypted = bytes.slice();
  encrypted[6] |= 1;
  await assert.rejects(validateBackup(encrypted));
});
test("BKP: manifest hash/count mismatch, unknown version, missing file and duplicate names fail", async () => {
  const files = unzipSync(await pack());
  const m = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  for (const modified of [
    { ...m, formatVersion: 99 },
    { ...m, counts: { ...m.counts, records: 123 } },
    { ...m, files: [...m.files, m.files[0]] },
  ]) {
    await assert.rejects(
      validateBackup(
        zipSync(
          { ...files, "manifest.json": strToU8(JSON.stringify(modified)) },
          { level: 0 },
        ),
      ),
    );
  }
  await assert.rejects(
    validateBackup(
      zipSync({ ...files, "records.json": strToU8("[]") }, { level: 0 }),
    ),
  );
  const noReadme = { ...files };
  delete noReadme["README.txt"];
  await assert.rejects(validateBackup(zipSync(noReadme, { level: 0 })));
  // Duplicate a permitted central/local filename of the same byte length.
  const dupe = await pack();
  const from = new TextEncoder().encode("entries.json"),
    to = new TextEncoder().encode("records.json");
  for (let i = 0; i < dupe.length - from.length; i++)
    if (from.every((b, j) => dupe[i + j] === b)) dupe.set(to, i);
  await assert.rejects(validateBackup(dupe), /重复/);
});
test("BKP: 10 MB original exact byte boundary, stream cancellation and pull backpressure", async () => {
  const bytes = new Uint8Array(LIMITS.file).fill(123),
    s = await fixture(bytes);
  const zip = await collect(exportZip(s, async () => bytes));
  assert.equal((await validateBackup(zip)).counts.originalBytes, LIMITS.file);
  assert.equal(
    await sha256(readStoredZip(zip).get(originalPath(s.attachments[0]))!),
    await sha256(bytes),
  );
  let reads = 0;
  const abort = new AbortController();
  const gen = exportZip(
    s,
    async () => {
      reads++;
      return bytes;
    },
    abort.signal,
  );
  await gen.next();
  assert.equal(reads, 0);
  abort.abort();
  await assert.rejects(gen.next(), { name: "AbortError" });
  assert.equal(reads, 0);
});
