import { z } from "zod";
import { BackupError, LIMITS, parseSnapshot } from "./format";
export const PREVIEW_BODY_LIMIT = LIMITS.metadata + 1024;
const envelope = z
  .object({ formatVersion: z.literal(1), snapshot: z.unknown() })
  .strict();
// Consume incrementally: no request.text() allocation before the limit is enforced.
export async function readPreviewRequest(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new BackupError("预检仅接受备份元数据 JSON，不接受原件或 ZIP 上传。");
  if (Number(request.headers.get("content-length")) > PREVIEW_BODY_LIMIT)
    throw new BackupError("预检元数据超过当前上限。");
  const reader = request.body?.getReader();
  if (!reader) throw new BackupError("请选择并校验备份后再预检。");
  const chunks: Uint8Array[] = [];
  let length = 0;
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, LIMITS.timeout);
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  request.signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      request.signal.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > PREVIEW_BODY_LIMIT)
        throw new BackupError("预检元数据超过当前上限。");
      chunks.push(part.value);
    }
    request.signal.throwIfAborted();
    if (expired) throw new BackupError("预检请求超时，请重试。");
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new BackupError("预检内容不完整或 JSON 格式无效。");
    }
    const parsed = envelope.safeParse(raw);
    if (!parsed.success) throw new BackupError("预检格式或版本不受支持。");
    return parseSnapshot(parsed.data.snapshot);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
  }
}
