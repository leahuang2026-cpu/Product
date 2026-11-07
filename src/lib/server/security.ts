export function sameOrigin(request: Request, expectedOrigin?: string) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return (
      new URL(origin).origin === new URL(expectedOrigin || request.url).origin
    );
  } catch {
    return false;
  }
}
export function isOwner(id: string | undefined, allowed: string | undefined) {
  return !!allowed && !!id && id === allowed;
}
export function safeImagePath(path: string) {
  return /^\/api\/attachments\/[a-zA-Z0-9-]+\/content$/.test(path);
}
