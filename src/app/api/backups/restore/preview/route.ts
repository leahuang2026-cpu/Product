import {
  authorize,
  dataReady,
  fail,
  ApiError,
  writeGuard,
  ok,
} from "@/lib/server/supabase";
import { BackupError, LIMITS } from "@/lib/backup/format";
import { readPreviewRequest } from "@/lib/backup/preview-request";
import { previewSnapshots } from "@/lib/backup/preview";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let busy = false;
export async function POST(request: Request) {
  let owned = false;
  try {
    writeGuard(request);
    const { db, user } = await authorize();
    dataReady();
    if (busy)
      throw new ApiError(429, "PREVIEW_BUSY", "已有预检正在进行，请稍后重试。");
    busy = true;
    owned = true;
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(LIMITS.timeout),
    ]);
    const candidate = await readPreviewRequest(request);
    const { data, error } = await db
      .rpc("personal_os_backup_snapshot_v1")
      .abortSignal(signal);
    if (error)
      throw new ApiError(
        503,
        "PREVIEW_UNAVAILABLE",
        "云端对比未完成，请稍后重试；没有恢复或修改任何内容。",
      );
    const occupied: string[] = [];
    // The snapshot excludes unbound uploads. Check only candidate IDs, within RLS;
    // no public Storage listing and no filenames/content are returned.
    for (let i = 0; i < candidate.attachments.length; i += 100) {
      const result = await db
        .from("personal_os_attachments")
        .select("id")
        .eq("owner_id", user.id)
        .is("record_id", null)
        .in(
          "id",
          candidate.attachments.slice(i, i + 100).map((a) => a.id),
        )
        .abortSignal(signal);
      if (result.error)
        throw new ApiError(
          503,
          "PREVIEW_UNAVAILABLE",
          "原件关联核对未完成，请稍后重试；没有写入内容。",
        );
      occupied.push(...(result.data || []).map((a) => a.id));
    }
    return ok(previewSnapshots(candidate, data, occupied));
  } catch (error) {
    return fail(
      error instanceof BackupError
        ? new ApiError(422, "PREVIEW_INVALID", error.message)
        : error,
    );
  } finally {
    if (owned) busy = false;
  }
}
