import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isOwner, sameOrigin } from "./security";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const configured = () =>
  !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_PUBLISHABLE_KEY &&
    process.env.PERSONAL_OS_OWNER_EMAIL
  );
export async function supabase() {
  if (!configured())
    throw new ApiError(
      503,
      "NOT_CONFIGURED",
      "私人云端连接尚未就绪，当前内容尚未保存。",
    );
  const jar = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) =>
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            }),
          ),
      },
    },
  );
}
export async function authorize() {
  const db = await supabase();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user)
    throw new ApiError(401, "LOGIN_REQUIRED", "请登录后重试，当前输入仍保留。");
  if (
    !(process.env.PERSONAL_OS_OWNER_ID
      ? isOwner(data.user.id, process.env.PERSONAL_OS_OWNER_ID)
      : !!data.user.email_confirmed_at &&
        data.user.email?.toLowerCase() ===
          process.env.PERSONAL_OS_OWNER_EMAIL?.toLowerCase())
  )
    throw new ApiError(403, "FORBIDDEN", "此空间仅对本人开放。");
  return { db, user: data.user };
}
export function writeGuard(request: Request) {
  if (!sameOrigin(request, process.env.APP_ORIGIN))
    throw new ApiError(403, "ORIGIN_REJECTED", "请求来源未获允许。");
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "JSON_REQUIRED", "请求格式不受支持。");
  const text = await request.text();
  if (text.length > 100_000)
    throw new ApiError(413, "TOO_LARGE", "内容超过当前提交上限。");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "请求内容不完整。");
  }
}
export function ok(data: unknown, status = 200) {
  return Response.json(
    { data },
    {
      status,
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    },
  );
}
export function fail(error: unknown) {
  const known = error instanceof ApiError;
  return Response.json(
    {
      error: {
        code: known ? error.code : "UNAVAILABLE",
        message: known ? error.message : "服务暂时不可用，请稍后重试。",
        retryable: !known || error.status >= 500,
      },
    },
    {
      status: known ? error.status : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
// Only enable after the separate data-contract / RLS review and integration verification.
export function dataReady() {
  if (process.env.PERSONAL_OS_DATA_CONTRACT !== "reviewed-v2")
    throw new ApiError(
      503,
      "DATA_NOT_READY",
      "记录服务尚未接通，当前内容尚未保存。",
    );
}
