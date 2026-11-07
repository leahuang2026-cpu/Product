import { z } from "zod";
import {
  supabase,
  writeGuard,
  jsonBody,
  ok,
  fail,
  ApiError,
} from "@/lib/server/supabase";
import { isOwner } from "@/lib/server/security";
export async function POST(request: Request) {
  try {
    writeGuard(request);
    const db = await supabase();
    const result = z
      .object({
        email: z.string().email(),
        token: z.string().regex(/^\d{6,10}$/),
      })
      .strict()
      .safeParse(await jsonBody(request));
    if (!result.success)
      throw new ApiError(400, "INVALID_CODE", "请检查邮箱和验证码。");
    if (
      result.data.email.toLowerCase() !==
      process.env.PERSONAL_OS_OWNER_EMAIL?.toLowerCase()
    )
      throw new ApiError(403, "FORBIDDEN", "此邮箱未获此空间的访问授权。");
    const { data, error } = await db.auth.verifyOtp({
      ...result.data,
      type: "email",
    });
    if (error || !data.user)
      throw new ApiError(
        401,
        "INVALID_CODE",
        "验证码无效或已过期，请重新获取。",
      );
    if (
      !(process.env.PERSONAL_OS_OWNER_ID
        ? isOwner(data.user.id, process.env.PERSONAL_OS_OWNER_ID)
        : !!data.user.email_confirmed_at &&
          data.user.email?.toLowerCase() ===
            process.env.PERSONAL_OS_OWNER_EMAIL?.toLowerCase())
    ) {
      await db.auth.signOut({ scope: "local" });
      throw new ApiError(403, "FORBIDDEN", "此账户未获授权。");
    }
    return ok({ authenticated: true });
  } catch (e) {
    return fail(e);
  }
}
