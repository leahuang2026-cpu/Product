import { z } from "zod";
import {
  supabase,
  writeGuard,
  jsonBody,
  ok,
  fail,
  ApiError,
} from "@/lib/server/supabase";
export async function POST(request: Request) {
  try {
    writeGuard(request);
    const db = await supabase();
    const body = z
      .object({ email: z.string().email() })
      .strict()
      .safeParse(await jsonBody(request));
    if (!body.success)
      throw new ApiError(400, "INVALID_EMAIL", "请填写有效邮箱。");
    if (
      body.data.email.toLowerCase() !==
      process.env.PERSONAL_OS_OWNER_EMAIL?.toLowerCase()
    )
      throw new ApiError(403, "FORBIDDEN", "此邮箱未获此空间的访问授权。");
    const { error } = await db.auth.signInWithOtp({
      email: body.data.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.APP_ORIGIN || new URL(request.url).origin}/auth/callback`,
      },
    });
    if (error)
      throw new ApiError(
        error.status === 429 ? 429 : 503,
        "OTP_FAILED",
        "验证码未能发送，请稍后重试。",
      );
    return ok({ sent: true });
  } catch (e) {
    return fail(e);
  }
}
