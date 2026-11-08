import {
  authorize,
  dataReady,
  fail,
  ApiError,
  writeGuard,
} from "@/lib/server/supabase";
import { BackupError, LIMITS, parseSnapshot } from "@/lib/backup/format";
import { exportZip } from "@/lib/backup/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Resource guard per process; not a cross-instance job or persistence mechanism.
let running = false;
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    writeGuard(request);
    const { db, user } = await authorize();
    dataReady();
    if (running)
      throw new ApiError(429, "BACKUP_BUSY", "已有备份正在生成，请稍后重试。");
    running = true;
    const controller = new AbortController();
    const abort = () => {
      controller.abort();
      release?.();
    };
    request.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, LIMITS.timeout);
    let released = false;
    release = () => {
      if (released) return;
      released = true;
      running = false;
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
    };
    if (request.signal.aborted) abort();
    const { data, error } = await db
      .rpc("personal_os_backup_snapshot_v1")
      .abortSignal(controller.signal);
    if (error) {
      if (error.code === "54000")
        throw new ApiError(
          413,
          "BACKUP_LIMIT",
          "档案超过本轮备份验证范围，未截断或省略内容。",
        );
      throw new ApiError(
        503,
        "BACKUP_UNAVAILABLE",
        "备份服务暂未就绪，完整备份未生成。请稍后重试。",
      );
    }
    const snapshot = parseSnapshot(data);
    const iterator = exportZip(
      snapshot,
      async (a) => {
        controller.signal.throwIfAborted();
        const result = await db.storage
          .from("personal-os-private")
          .download(`${user.id}/${a.id}`, {}, { signal: controller.signal })
          .asStream();
        if (result.error || !result.data)
          throw new BackupError("原件读取失败，完整备份未生成。");
        const reader = result.data.getReader();
        const bytes = new Uint8Array(a.bytes);
        let offset = 0;
        try {
          while (true) {
            controller.signal.throwIfAborted();
            const part = await reader.read();
            if (part.done) break;
            if (offset + part.value.length > a.bytes)
              throw new BackupError("原件大小不符，完整备份未生成。");
            bytes.set(part.value, offset);
            offset += part.value.length;
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        if (offset !== a.bytes) throw new BackupError("原件传输不完整。");
        return bytes;
      },
      controller.signal,
    );
    const done = release;
    const stream = new ReadableStream<Uint8Array>(
      {
        async pull(c) {
          try {
            const next = await iterator.next();
            if (next.done) {
              c.close();
              done();
            } else c.enqueue(next.value);
          } catch {
            c.error(new Error("完整备份未生成，请重试。"));
            done();
          }
        },
        async cancel() {
          controller.abort();
          try {
            await iterator.return(undefined);
          } finally {
            done();
          }
        },
      },
      { highWaterMark: 1 },
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="personal-os-backup.zip"',
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    release?.();
    return fail(
      error instanceof BackupError
        ? new ApiError(422, "BACKUP_INVALID", error.message)
        : error,
    );
  }
}
