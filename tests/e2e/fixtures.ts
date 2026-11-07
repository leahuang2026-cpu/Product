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
    trashedRecords: [] as RecordItem[],
    trashedEntries: [] as Entry[],
    failTrash: false,
    trashUnavailable: false,
    dropTrashResponse: false,
    trashPosts: [] as { body: string; key: string }[],
    failSave: false,
    failUpload: false,
    failMetadata: false,
    readError: false,
    dropResponse: false,
    posts: [] as string[],
  };
  const trashRequests = new Map<string, { body: string; result: unknown }>();
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
    if (url.pathname === "/api/trash") {
      if (state.trashUnavailable) return fail("回收站尚未接通，内容未移动。");
      if (method === "GET")
        return data([
          ...state.trashedRecords.map((r) => ({
            id: r.id,
            kind: "record",
            title: r.originalText,
            deletedAt: "2026-11-08T00:00:00Z",
            version: r.version,
          })),
          ...state.trashedEntries.map((e) => ({
            id: e.id,
            kind: e.kind,
            title: e.title || e.body,
            deletedAt: "2026-11-08T00:00:00Z",
            version: e.version,
          })),
        ]);
      const input = req.postDataJSON(),
        body = req.postData()!,
        key = req.headers()["idempotency-key"];
      state.trashPosts.push({ body, key });
      if (state.failTrash) return fail("服务暂不可用，内容未移动，请重试。");
      const cached = trashRequests.get(key);
      if (cached) return data(cached.result);
      const from: (RecordItem | Entry)[] =
        input.kind === "record"
          ? input.deleted
            ? state.records
            : state.trashedRecords
          : input.deleted
            ? state.entries
            : state.trashedEntries;
      const item = from.find((x) => x.id === input.id);
      if (!item || item.version !== input.version)
        return route.fulfill({
          status: 409,
          json: {
            error: { code: "CONFLICT", message: "内容已变化，请重新读取。" },
          },
        });
      if (
        input.deleted &&
        input.kind === "direction" &&
        state.entries.some(
          (e) => e.kind === "focus" && e.relationId === input.id,
        )
      )
        return route.fulfill({
          status: 409,
          json: {
            error: {
              code: "DIRECTION_LINKED",
              message:
                "此方向仍有关联关注，请先编辑关联关注，解除关联后重试。内容未移动。",
            },
          },
        });
      from.splice(from.indexOf(item), 1);
      item.version++;
      if (input.kind === "record")
        (input.deleted ? state.trashedRecords : state.records).push(
          item as RecordItem,
        );
      else
        (input.deleted ? state.trashedEntries : state.entries).push(
          item as Entry,
        );
      const result = {
        id: input.id,
        kind: input.kind,
        deleted: input.deleted,
        version: item.version,
      };
      trashRequests.set(key, { body, result });
      if (state.dropTrashResponse) {
        state.dropTrashResponse = false;
        return route.abort("failed");
      }
      return data(result);
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
    if (state.trashedRecords.some((r) => r.id === id))
      return route.fulfill({
        status: 410,
        json: {
          error: {
            code: "IN_TRASH",
            message: "此记录已移入回收站。可在设置的回收站中恢复。",
          },
        },
      });
    return route.fulfill({
      status: 404,
      json: { error: { message: "记录不可访问。" } },
    });
  });
  return state;
}
