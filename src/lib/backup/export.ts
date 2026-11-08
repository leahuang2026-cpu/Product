import { Zip, ZipPassThrough } from "fflate";
import {
  counts,
  ensure,
  jsonBytes,
  LIMITS,
  originalPath,
  parseSnapshot,
  scope,
  sha256,
  type BackupAttachment,
  type Manifest,
} from "./format";

export const README = `Personal OS backup format 1\nUnencrypted private archive, including recycle bin and inactive Focus.\nJSON files preserve original text, dates, relationships and states. originals/ contains unchanged file bytes.\nExcludes Auth, credentials, configuration, request caches, unbound uploads and unsaved/local drafts.\nSHA-256 checks integrity, not authenticity or encryption. No platform disaster recovery included.\nThis version uses ZIP STORE (no recompression). Repacking/compressed/encrypted ZIP is not supported by the validator.\nRuntime row versions are sourceVersion metadata, not permission to overwrite.\nRestore writing is not implemented. Keep this file private.\n`;

// Backpressure: at most one <=10 MB original plus bounded JSON is queued at once.
// manifest and ZIP end are emitted only after every original passes validation.
export async function* exportZip(
  value: unknown,
  readOriginal: (a: BackupAttachment) => Promise<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<Uint8Array> {
  const s = parseSnapshot(value);
  const manifest: Manifest = {
    format: "personal-os-backup",
    formatVersion: 1,
    dataContract: "reviewed-v2+recycle-bin-v1",
    id: crypto.randomUUID(),
    snapshotAt: s.snapshotAt,
    completedAt: s.snapshotAt,
    scope,
    encrypted: false,
    counts: counts(s),
    files: [],
  };
  let queue: Uint8Array[] = [],
    error: Error | null = null,
    total = 0;
  const zip = new Zip((err, bytes) => {
    if (err) error = err;
    else queue.push(bytes);
  });
  function add(path: string, bytes: Uint8Array) {
    signal?.throwIfAborted();
    const file = new ZipPassThrough(path);
    zip.add(file);
    file.push(bytes, true);
    if (error) throw error;
  }
  function* drain() {
    for (const chunk of queue) {
      signal?.throwIfAborted();
      total += chunk.length;
      ensure(total <= LIMITS.zip, "备份包超过当前传输上限。");
      yield chunk;
    }
    queue = [];
  }
  try {
    const metadata: [string, Uint8Array][] = [
      ["records.json", jsonBytes(s.records)],
      ["entries.json", jsonBytes(s.entries)],
      ["attachments.json", jsonBytes(s.attachments)],
      ["README.txt", new TextEncoder().encode(README)],
    ];
    for (const [path, bytes] of metadata) {
      manifest.files.push({
        path,
        bytes: bytes.length,
        sha256: await sha256(bytes),
      });
      add(path, bytes);
      yield* drain();
    }
    for (const a of s.attachments) {
      signal?.throwIfAborted();
      const bytes = await readOriginal(a);
      ensure(
        bytes.length === a.bytes && (await sha256(bytes)) === a.sha256,
        "原件缺失或完整性不符，完整备份未生成。",
      );
      const path = originalPath(a);
      manifest.files.push({ path, bytes: bytes.length, sha256: a.sha256 });
      add(path, bytes);
      yield* drain();
    }
    manifest.completedAt = new Date().toISOString();
    add("manifest.json", jsonBytes(manifest));
    yield* drain();
    zip.end();
    if (error) throw error;
    yield* drain();
  } finally {
    zip.terminate();
  }
}
