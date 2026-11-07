export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(30000),
    });
  } catch (e) {
    if (init?.signal?.aborted) throw e;
    throw new RequestError(
      "尚未确认保存或读取结果，请重试。当前输入仍保留。",
      0,
      "NETWORK",
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || !("data" in result))
    throw new RequestError(
      result?.error?.message || "服务暂时不可用，请重试。",
      response.status,
      result?.error?.code || "UNAVAILABLE",
    );
  return result.data as T;
}
