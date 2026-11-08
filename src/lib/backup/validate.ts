import {
  counts,
  ensure,
  LIMITS,
  manifestSchema,
  originalPath,
  parseSnapshot,
  sha256,
  type Summary,
} from "./format";

const decoder = new TextDecoder("utf-8", { fatal: true });
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// Strict reader for our STORE-only format. Never inflates, extracts paths, or executes files.
// Checking the central directory *before* touching payloads rejects ZIP bombs and duplicate names.
export function readStoredZip(bytes: Uint8Array): Map<string, Uint8Array> {
  ensure(
    bytes.length >= 22 && bytes.length <= LIMITS.zip,
    "文件为空、不是完整 ZIP 或超过 64 MiB 校验上限。",
  );
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  const u16 = (p: number) => v.getUint16(p, true),
    u32 = (p: number) => v.getUint32(p, true);
  ensure(
    u32(end) === 0x06054b50 && !u16(end + 4) && !u16(end + 6) && !u16(end + 20),
    "ZIP 未完成或使用了不支持的分卷/注释格式。",
  );
  const count = u16(end + 10),
    start = u32(end + 16);
  ensure(
    count >= 5 &&
      count <= LIMITS.attachments + 5 &&
      count === u16(end + 8) &&
      start + u32(end + 12) === end,
    "ZIP 目录或文件数量不正确。",
  );
  let p = start,
    nextLocal = 0,
    metadata = 0,
    originals = 0;
  const files = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    ensure(p + 46 <= end && u32(p) === 0x02014b50, "ZIP 目录损坏。");
    const flags = u16(p + 8),
      method = u16(p + 10),
      crc = u32(p + 16),
      compressed = u32(p + 20),
      size = u32(p + 24);
    const nameLength = u16(p + 28),
      extra = u16(p + 30),
      comment = u16(p + 32),
      local = u32(p + 42),
      mode = (u32(p + 38) >>> 16) & 0xf000;
    ensure(p + 46 + nameLength + extra + comment <= end, "ZIP 目录不完整。");
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    ensure(
      /^(manifest\.json|records\.json|entries\.json|attachments\.json|README\.txt|originals\/[a-f0-9-]{36}\.(png|jpg|mp3|wav|ogg|webm|m4a))$/.test(
        name,
      ) && !files.has(name),
      "备份存在危险路径、额外文件或重复文件名。",
    );
    ensure(
      method === 0 &&
        compressed === size &&
        (flags & ~0x808) === 0 &&
        (!mode || mode === 0x8000) &&
        !u16(p + 34),
      "仅支持本应用未加密、未重新压缩的普通备份文件；不支持符号链接。",
    );
    if (name.startsWith("originals/")) {
      originals += size;
      ensure(
        size > 0 && size <= LIMITS.file && originals <= LIMITS.originals,
        "原件超过校验范围。",
      );
    } else {
      metadata += size;
      ensure(
        metadata <= LIMITS.metadata + 512_000 && size <= LIMITS.metadata,
        "备份元数据超限。",
      );
    }
    ensure(
      local === nextLocal &&
        local + 30 <= start &&
        u32(local) === 0x04034b50 &&
        u16(local + 6) === flags &&
        u16(local + 8) === method,
      "ZIP 本地目录不一致。",
    );
    const localName = u16(local + 26),
      localExtra = u16(local + 28),
      dataStart = local + 30 + localName + localExtra;
    ensure(
      dataStart + size <= start &&
        decoder.decode(bytes.subarray(local + 30, local + 30 + localName)) ===
          name,
      "ZIP 内容边界或名称不一致。",
    );
    nextLocal = dataStart + size;
    if (flags & 8) {
      ensure(
        nextLocal + 16 <= start &&
          u32(nextLocal) === 0x08074b50 &&
          u32(nextLocal + 4) === crc &&
          u32(nextLocal + 8) === size &&
          u32(nextLocal + 12) === size,
        "ZIP 传输未完成。",
      );
      nextLocal += 16;
    } else {
      ensure(
        u32(local + 14) === crc &&
          u32(local + 18) === size &&
          u32(local + 22) === size,
        "ZIP 文件长度不一致。",
      );
    }
    const content = bytes.subarray(dataStart, dataStart + size);
    ensure(crc32(content) === crc, "ZIP 文件内容损坏。");
    files.set(name, content);
    p += 46 + nameLength + extra + comment;
  }
  ensure(p === end && nextLocal === start, "ZIP 含未声明内容或目录损坏。");
  return files;
}
export async function validateBackup(bytes: Uint8Array): Promise<Summary> {
  const files = readStoredZip(bytes);
  function json(name: string): unknown {
    const b = files.get(name);
    ensure(b, "备份缺少必要的元数据文件。");
    try {
      return JSON.parse(decoder.decode(b));
    } catch {
      throw new Error("备份 JSON 格式损坏。");
    }
  }
  const result = manifestSchema.safeParse(json("manifest.json"));
  ensure(
    result.success,
    "不是受支持的 Personal OS 备份版本；旧浏览器 JSON 不能用于云端校验。",
  );
  const m = result.data;
  ensure(
    m.files.length + 1 === files.size &&
      new Set(m.files.map((f) => f.path)).size === m.files.length,
    "清单重复或文件数量不一致。",
  );
  for (const f of m.files) {
    const b = files.get(f.path);
    ensure(
      f.path !== "manifest.json" &&
        b &&
        b.length === f.bytes &&
        (await sha256(b)) === f.sha256,
      "备份缺件或 SHA-256 校验不符。",
    );
  }
  const snapshot = parseSnapshot({
    snapshotAt: m.snapshotAt,
    records: json("records.json"),
    entries: json("entries.json"),
    attachments: json("attachments.json"),
  });
  ensure(
    files.has("README.txt") && files.size === snapshot.attachments.length + 5,
    "原件目录与清单不一致。",
  );
  for (const a of snapshot.attachments) {
    const b = files.get(originalPath(a));
    ensure(
      b && b.length === a.bytes && (await sha256(b)) === a.sha256,
      "原件与附件元数据不一致。",
    );
  }
  const actual = counts(snapshot);
  ensure(
    Object.entries(actual).every(
      ([k, v]) => m.counts[k as keyof typeof actual] === v,
    ),
    "备份计数与实际内容不一致。",
  );
  return { snapshotAt: m.snapshotAt, counts: actual };
}
