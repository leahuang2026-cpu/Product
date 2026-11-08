import { test, expect, type Page } from "@playwright/test";
import { mockAPI } from "./fixtures";
import { fixture, collect, png, stamp } from "../backup-fixture";
import { exportZip } from "../../src/lib/backup/export";
import { previewSnapshots } from "../../src/lib/backup/preview";
const consent = "我同意将以上文字与元数据发给自己的服务，只进行对比";
async function choose(page: Page) {
  const bytes = await collect(exportZip(await fixture(), async () => png));
  await page.getByLabel("校验已有备份（仅在本机读取）").setInputFiles({
    name: "synthetic.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(bytes),
  });
  await expect(
    page.getByRole("heading", { name: "恢复前只读预检" }),
  ).toBeVisible();
}
test("preview: local-only until explicit consent; same/new/conflict and filters; no writes", async ({
  page,
}) => {
  await mockAPI(page);
  const s = await fixture();
  let target = structuredClone(s);
  let calls = 0;
  await page.route("**/api/backups/restore/preview", (route) => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.formatVersion).toBe(1);
    expect(body.snapshot).toEqual(s);
    expect(JSON.stringify(body)).not.toContain(png.toString("base64"));
    return route.fulfill({
      json: { data: previewSnapshots(body.snapshot, target) },
    });
  });
  await page.goto("/settings");
  await choose(page);
  expect(calls).toBe(0);
  await expect(
    page.getByRole("button", { name: "只读对比云端" }),
  ).toBeDisabled();
  await page.getByLabel(consent).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "只读对比云端" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "未发现元数据冲突" }),
  ).toBeVisible();
  await expect(
    page.getByText("待新增 0 项 · 相同 5 项 · 冲突 0 项 · 不支持 0 项"),
  ).toBeVisible();
  target.records[0].note = "changed";
  await page.getByRole("button", { name: "只读对比云端" }).click();
  await expect(
    page.getByRole("heading", { name: "存在冲突或不支持内容，整批应停止" }),
  ).toBeVisible();
  const panel = page.locator(".restore-preview");
  await panel.getByRole("button", { name: "冲突", exact: true }).click();
  await expect(panel.locator("li")).toHaveCount(1);
  await expect(panel).toContainText("补充说明不同");
  await panel.getByRole("button", { name: "待新增", exact: true }).click();
  await expect(panel).toContainText("此类别没有内容");
  target = { snapshotAt: stamp, records: [], entries: [], attachments: [] };
  await page.getByRole("button", { name: "只读对比云端" }).click();
  await expect(
    page.getByText("待新增 5 项 · 相同 0 项 · 冲突 0 项 · 不支持 0 项"),
  ).toBeVisible();
  await panel.getByRole("button", { name: "清除预检结果" }).click();
  await expect(panel.locator(".preview-results")).toHaveCount(0);
  await expect(page.getByLabel(consent)).not.toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "执行恢复", exact: true }),
  ).toHaveCount(0);
});
test("preview: failure/retry, cancel and changing file invalidate results", async ({
  page,
}) => {
  await mockAPI(page);
  const s = await fixture();
  let mode = 0;
  await page.route("**/api/backups/restore/preview", async (route) => {
    if (mode === 0)
      return route.fulfill({
        status: 503,
        json: { error: { message: "合成预检失败，未写入。" } },
      });
    if (mode === 2) {
      await new Promise((r) => setTimeout(r, 500));
      return route
        .fulfill({ json: { data: previewSnapshots(s, s) } })
        .catch(() => {});
    }
    return route.fulfill({ json: { data: previewSnapshots(s, s) } });
  });
  await page.goto("/settings");
  await choose(page);
  await page.getByLabel(consent).check();
  await page.getByRole("button", { name: "只读对比云端" }).click();
  await expect(
    page.locator(".restore-preview").getByRole("alert"),
  ).toContainText("预检失败");
  mode = 1;
  await page.getByRole("button", { name: "只读对比云端" }).click();
  await expect(page.locator(".preview-results")).toBeVisible();
  mode = 2;
  await page.getByRole("button", { name: "只读对比云端" }).click();
  await page.getByRole("button", { name: "取消预检", exact: true }).click();
  await expect(page.locator(".preview-results")).toHaveCount(0);
  await expect(page.locator(".restore-preview")).toContainText(
    "已取消或清除预检",
  );
  await page.getByRole("button", { name: "清除文件与结果" }).click();
  await expect(page.locator(".restore-preview")).toHaveCount(0);
  await choose(page);
  await expect(page.getByLabel(consent)).not.toBeChecked();
});
test("preview API: real local endpoint rejects cross-origin and anonymous requests", async ({
  request,
}) => {
  const cross = await request.post("/api/backups/restore/preview", {
    headers: { Origin: "https://example.test" },
    data: {},
  });
  expect(cross.status()).toBe(403);
  expect((await cross.json()).error.code).toBe("ORIGIN_REJECTED");
  const anon = await request.post("/api/backups/restore/preview", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: {},
  });
  expect([401, 503]).toContain(anon.status());
  expect(["LOGIN_REQUIRED", "NOT_CONFIGURED"]).toContain(
    (await anon.json()).error.code,
  );
  expect(anon.headers()["cache-control"]).toContain("no-store");
});
