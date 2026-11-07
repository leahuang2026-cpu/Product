import { NextResponse } from "next/server";
import { authorize, supabase } from "@/lib/server/supabase";
export async function GET(request: Request) {
  const origin = process.env.APP_ORIGIN || new URL(request.url).origin;
  const target = new URL("/login", origin);
  try {
    const code = new URL(request.url).searchParams.get("code");
    if (!code) throw new Error("missing code");
    const db = await supabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) throw error;
    try {
      await authorize();
    } catch {
      await db.auth.signOut({ scope: "local" });
      throw new Error("not allowed");
    }
    const response = NextResponse.redirect(new URL("/settings", origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    target.searchParams.set("error", "login_failed");
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
