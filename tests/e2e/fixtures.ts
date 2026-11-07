import type { Page } from "@playwright/test";
import type { RecordItem, Entry } from "../../src/lib/os/model";
export const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWPYe/MrAATiAoxBHmUVAAAAAElFTkSuQmCC",
  "base64",
);
export const one = "11111111-1111-4111-8111-111111111111",
  two = "22222222-2222-4222-8222-222222222222";
export async function mockAPI(page: Page) {
  const state = {
    records: [
      {
        id: one,
        originalText: "给生活留一点空白。\n这是虚构的测试记录。",
        note: "",
        domains: ["生活"],
        isIdea: false,
        createdAt: "2026-11-06T00:00:00Z",
        version: 1,
        attachments: [],
        links: [],
      },
      {
        id: two,
        originalText: "学习数据库，让想法变成作品。",
        note: "",
        domains: ["职业", "能力"],
        isIdea: true,
        createdAt: "2026-11-05T00:00:00Z",
        version: 1,
        attachments: [],
        links: [],
      },
    ] as RecordItem[],
    entries: [] as Entry[],
    failSave: false,
    failUpload: false,
    failMetadata: false,
    readError: false,
    dropResponse: false,
    posts: [] as string[],
  };
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      method = req.method();
    const data = (value: unknown, status = 200) =>
      route.fulfill({ status, json: { data: value } });
    const fail = (message: string) =>
      route.fulfill({
        status: 503,
        json: { error: { code: "TEST_FAILURE", message } },
      });
    if (url.pathname === "/api/auth/session")
      return data({
        configured: true,
        authenticated: true,
        email: "synthetic@example.test",
      });
    if (url.pathname.startsWith("/api/auth/"))
      return data({ sent: true, authenticated: true });
    if (url.pathname.endsWith("/content"))
      return route.fulfill({ contentType: "image/png", body: png });
    if (url.pathname === "/api/uploads") {
      if (state.failUpload) return fail("图片尚未保存，请重试或移除。");
      const raw = req.postDataBuffer()?.toString() || "";
      const id = /name="id"\r\n\r\n([a-f0-9-]+)/.exec(raw)?.[1];
      return data({ id });
    }
    if (url.pathname === "/api/entries") {
      if (method === "GET") return data(state.entries);
      const entry = req.postDataJSON();
      const i = state.entries.findIndex((x) => x.id === entry.id);
      entry.version++;
      if (i >= 0) state.entries[i] = entry;
      else state.entries.push(entry);
      return data(entry);
    }
    if (url.pathname === "/api/records" && method === "GET")
      return state.readError ? fail("读取失败，请重试。") : data(state.records);
    if (url.pathname === "/api/records" && method === "POST") {
      const body = req.postDataJSON();
      state.posts.push(body.id);
      if (state.failSave) return fail("尚未保存，请重试。");
      let record = state.records.find((r) => r.id === body.id);
      if (!record) {
        record = {
          ...body,
          note: "",
          domains: [],
          isIdea: false,
          version: 1,
          createdAt: "2026-11-06T12:00:00Z",
          attachments: body.attachmentIds.map((id: string) => ({
            id,
            name: "memory.png",
            mime: "image/png",
            bytes: png.length,
            contentPath: `/api/attachments/${id}/content`,
          })),
        };
        state.records.push(record!);
      }
      if (state.dropResponse) {
        state.dropResponse = false;
        return route.abort("failed");
      }
      return data(record, 201);
    }
    const id = url.pathname.split("/").at(-1);
    const record = state.records.find((r) => r.id === id);
    if (record) {
      if (method === "PATCH") {
        if (state.failMetadata) return fail("领域或标记未保存，请重试。");
        Object.assign(record, req.postDataJSON(), {
          version: record.version + 1,
        });
      }
      return data(record);
    }
    return route.fulfill({
      status: 404,
      json: { error: { message: "记录不可访问。" } },
    });
  });
  return state;
}
