"use client";
import { useState, type FormEvent } from "react";
import { request } from "@/lib/os/client";
import { useOS } from "./context";
import { Notice } from "./common";
export function Login() {
  const { session, sessionError, refreshSession } = useOS();
  const [email, setEmail] = useState(""),
    [token, setToken] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(`/api/auth/${sent ? "verify" : "login"}`, {
        method: "POST",
        body: JSON.stringify(sent ? { email, token } : { email }),
      });
      if (sent) await refreshSession();
      else setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (session?.authenticated)
    return (
      <div className="panel">
        <h2>私人空间已登录</h2>
        <p>{session.email}</p>
        <button
          className="button quiet"
          onClick={async () => {
            try {
              await request("/api/auth/logout", { method: "POST" });
              await refreshSession();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          退出登录
        </button>
        {error && <Notice error={error} />}
      </div>
    );
  return (
    <section className="panel login-panel">
      <h2>回到自己的空间</h2>
      <p>使用本人邮箱登录，读取你的私人记录。</p>
      {session?.configured === false && (
        <Notice error="私人云端连接尚未就绪。配置完成后可登录，当前不会上传或保存输入。" />
      )}
      {sessionError && (
        <Notice error={sessionError} onRetry={() => void refreshSession()} />
      )}
      <form onSubmit={submit}>
        <label>
          邮箱
          <input
            type="email"
            autoComplete="email"
            value={email}
            required
            disabled={sent || busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {sent && (
          <>
            <p role="status">
              登录邮件已发送。可打开邮件链接；若邮件包含验证码，也可在此填写。
            </p>
            <label>
              验证码
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
          </>
        )}
        <button
          className="button primary"
          disabled={busy || !session?.configured}
        >
          {busy ? "请稍候…" : sent ? "登录" : "发送验证码"}
        </button>
        {sent && (
          <button
            className="button quiet"
            type="button"
            onClick={() => {
              setSent(false);
              setToken("");
            }}
          >
            重新获取验证码
          </button>
        )}
      </form>
      {error && <Notice error={error} />}
    </section>
  );
}
