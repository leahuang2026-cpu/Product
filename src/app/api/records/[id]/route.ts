import {
  authorize,
  dataReady,
  fail,
  ok,
  jsonBody,
  writeGuard,
  ApiError,
} from "@/lib/server/supabase";
import { metadataSchema } from "@/lib/os/model";
import { dbError, normalizeRecord } from "@/lib/server/records";
import { z } from "zod";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  try {
    const { db } = await authorize();
    dataReady();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "找不到可访问的记录。");
    const { data, error } = await db.rpc("personal_os_get_record", {
      record_id: id,
    });
    dbError(error);
    if (data?.deletedAt)
      throw new ApiError(
        410,
        "IN_TRASH",
        "此记录已移入回收站。可在设置的回收站中恢复。",
      );
    if (!data) throw new ApiError(404, "NOT_FOUND", "找不到可访问的记录。");
    return ok(normalizeRecord(data));
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    writeGuard(request);
    const { db } = await authorize();
    dataReady();
    const { id } = await context.params;
    const result = metadataSchema.safeParse(await jsonBody(request));
    if (!result.success || !z.string().uuid().safeParse(id).success)
      throw new ApiError(400, "INVALID_METADATA", "分类或说明格式无效。");
    const key = request.headers.get("Idempotency-Key");
    if (!key || !z.string().uuid().safeParse(key).success)
      throw new ApiError(400, "KEY_REQUIRED", "请求标识无效。");
    const current = await db.rpc("personal_os_get_record", { record_id: id });
    dbError(current.error);
    if (current.data?.deletedAt)
      throw new ApiError(
        410,
        "IN_TRASH",
        "请先在回收站恢复记录，再编辑说明或领域。",
      );
    const { data, error } = await db.rpc("personal_os_update_metadata", {
      record_id: id,
      payload: result.data,
      request_key: key,
    });
    dbError(error);
    return ok(normalizeRecord(data));
  } catch (e) {
    return fail(e);
  }
}
