import { z } from "zod";
import {
  authorize,
  dataReady,
  writeGuard,
  jsonBody,
  ok,
  fail,
  ApiError,
} from "@/lib/server/supabase";
import { trashSchema } from "@/lib/os/model";
import { dbError } from "@/lib/server/records";

function trashError(error: { code?: string } | null) {
  if (error?.code === "PGRST202" || error?.code === "42883")
    throw new ApiError(
      503,
      "TRASH_NOT_READY",
      "回收站尚未接通，内容未移动。请先完成回收站数据库更新。",
    );
  dbError(error);
}
export async function GET() {
  try {
    const { db } = await authorize();
    dataReady();
    const { data, error } = await db.rpc("personal_os_list_trash");
    trashError(error);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    writeGuard(request);
    const { db } = await authorize();
    dataReady();
    const payload = trashSchema.safeParse(await jsonBody(request));
    const key = request.headers.get("Idempotency-Key");
    if (!payload.success || !key || !z.string().uuid().safeParse(key).success)
      throw new ApiError(
        400,
        "INVALID_TRASH",
        "移入或恢复请求无效，请重新读取内容后重试。",
      );
    const { data, error } = await db.rpc("personal_os_set_trash", {
      payload: payload.data,
      request_key: key,
    });
    trashError(error);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
