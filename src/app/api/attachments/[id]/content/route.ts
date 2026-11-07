import { authorize, dataReady, fail, ApiError } from "@/lib/server/supabase";
import { dbError } from "@/lib/server/records";
import { z } from "zod";
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { db, user } = await authorize();
    dataReady();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      throw new ApiError(404, "NOT_FOUND", "附件不可访问。");
    const { data, error } = await db
      .from("personal_os_attachments")
      .select("object_key,mime,name")
      .eq("id", id)
      .eq("owner_id", user.id)
      .not("record_id", "is", null)
      .maybeSingle();
    dbError(error);
    if (!data) throw new ApiError(404, "NOT_FOUND", "附件不可访问。");
    const result = await db.storage
      .from("personal-os-private")
      .download(data.object_key);
    if (result.error || !result.data)
      throw new ApiError(503, "READ_FAILED", "原件读取失败，请重试。");
    return new Response(result.data, {
      headers: {
        "Content-Type": data.mime,
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(data.name)}`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
