import {
  authorize,
  configured,
  fail,
  ok,
  ApiError,
} from "@/lib/server/supabase";
export async function GET() {
  if (!configured()) return ok({ configured: false, authenticated: false });
  try {
    const { user } = await authorize();
    return ok({ configured: true, authenticated: true, email: user.email });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401)
      return ok({ configured: true, authenticated: false });
    return fail(e);
  }
}
