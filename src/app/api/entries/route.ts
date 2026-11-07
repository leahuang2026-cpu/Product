import {
  authorize,
  dataReady,
  fail,
  ok,
  jsonBody,
  writeGuard,
  ApiError,
} from "@/lib/server/supabase";
import { entrySchema } from "@/lib/os/model";
import { dbError } from "@/lib/server/records";
import { z } from "zod";
export async function GET() {
  try {
    const { db } = await authorize();
    dataReady();
    const { data, error } = await db.rpc("personal_os_list_entries");
    dbError(error);
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
    const parsed = entrySchema.safeParse(await jsonBody(request));
    const key = request.headers.get("Idempotency-Key");
    if (!parsed.success || !key || !z.string().uuid().safeParse(key).success)
      throw new ApiError(400, "INVALID_ENTRY", "请检查内容及请求标识。");
    const { data, error } = await db.rpc("personal_os_save_entry", {
      payload: parsed.data,
      request_key: key,
    });
    dbError(error);
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
