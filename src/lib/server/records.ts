import { ApiError } from "./supabase";
import type { RecordItem } from "../os/model";
// RPC returns only the owner's rows; DTO shape is the reviewed v2 contract proposal.
export function normalizeRecord(row: RecordItem): RecordItem {
  return {
    ...row,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      mime: a.mime,
      bytes: a.bytes,
      contentPath: `/api/attachments/${a.id}/content`,
    })),
  };
}
export function dbError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "40001" || error.code === "23505")
    throw new ApiError(
      409,
      "CONFLICT",
      "内容已发生变化，请重新读取后决定是否提交。",
    );
  if (error.code === "42501")
    throw new ApiError(403, "FORBIDDEN", "没有访问此内容的权限。");
  throw new ApiError(
    503,
    "DATA_UNAVAILABLE",
    "记录服务暂时不可用，尚未确认保存结果。请重试。",
  );
}
