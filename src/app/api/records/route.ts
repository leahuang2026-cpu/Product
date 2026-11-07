import {
  authorize,
  dataReady,
  fail,
  ok,
  jsonBody,
  writeGuard,
  ApiError,
} from "@/lib/server/supabase";
import { createRecordSchema } from "@/lib/os/model";
import { dbError, normalizeRecord } from "@/lib/server/records";
import type { RecordItem } from "@/lib/os/model";
export async function GET() {
  try {
    const { db } = await authorize();
    dataReady();
    const { data, error } = await db.rpc("personal_os_list_records");
    dbError(error);
    return ok((data as RecordItem[]).map(normalizeRecord));
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    writeGuard(request);
    const { db } = await authorize();
    dataReady();
    const result = createRecordSchema.safeParse(await jsonBody(request));
    if (!result.success)
      throw new ApiError(
        400,
        "INVALID_RECORD",
        "请检查内容及附件，原文与附件不能同时为空。",
      );
    const { data, error } = await db.rpc("personal_os_save_record", {
      payload: result.data,
    });
    dbError(error);
    if (data?.deletedAt)
      throw new ApiError(
        410,
        "IN_TRASH",
        "此记录已移入回收站。可在设置中恢复，未重新创建记录。",
      );
    return ok(normalizeRecord(data as RecordItem), 201);
  } catch (e) {
    return fail(e);
  }
}
