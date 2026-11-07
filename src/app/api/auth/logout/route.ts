import {
  supabase,
  writeGuard,
  ok,
  fail,
  ApiError,
} from "@/lib/server/supabase";
export async function POST(request: Request) {
  try {
    writeGuard(request);
    const db = await supabase();
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) throw new ApiError(503, "LOGOUT_FAILED", "未能退出，请重试。");
    return ok({ authenticated: false });
  } catch (e) {
    return fail(e);
  }
}
