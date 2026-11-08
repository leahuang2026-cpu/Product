import { test, expect } from "@playwright/test";
import { mockAPI } from "./fixtures";
import { fixture, collect, png } from "../backup-fixture";
import { exportZip } from "../../src/lib/backup/export";
import { validateBackup } from "../../src/lib/backup/validate";
import { readFile } from "node:fs/promises";

async function backupBytes() {
  return Buffer.from(
    await collect(exportZip(await fixture(), async () => png)),
  );
}
const generate = "生成完整云端备份";
const consent = "我了解备份未加密，包含回收站内容";

test("backup: privacy consent, complete download, local recheck without upload, clear and layout", async ({
  page,
}) => {
  await mockAPI(page);
  const bytes = await backupBytes();
  let calls = 0;
  await page.route("**/api/backups/export", (route) => {
    calls++;
    return route.fulfill({ contentType: "application/zip", body: bytes });
  });
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: generate })).toBeDisabled();
  await page.getByLabel(consent).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: generate }).click();
  await expect(page.getByRole("link", { name: "保存备份文件" })).toBeVisible();
  await expect(
    page.getByText("1 条记录（回收站 1 条） · 1 个原件"),
  ).toBeVisible();
  await page
    .locator(".backup-panel")
    .screenshot({ path: test.info().outputPath("backup-panel.png") });
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: "保存备份文件" }).click();
  const download = await event,
    file = await download.path();
  expect(file).toBeTruthy();
  const saved = await readFile(file!);
  expect((await validateBackup(saved)).counts.inactiveFocus).toBe(1);
  await page.getByRole("button", { name: "清除文件与结果" }).click();
  await expect(page.getByRole("button", { name: generate })).toBeFocused();
  await expect(page.getByRole("link", { name: "保存备份文件" })).toHaveCount(0);
  await page.getByLabel("校验已有备份（仅在本机读取）").setInputFiles({
    name: "synthetic.zip",
    mimeType: "application/zip",
    buffer: saved,
  });
  await expect(
    page.getByText(
      "所选本地备份完整性校验通过。未验证目标空间恢复，也未写入云端。",
    ),
  ).toBeVisible();
  expect(calls).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const button = await page
    .getByRole("button", { name: generate })
    .boundingBox();
  expect(button!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "清除文件与结果" }).click();
  await expect(page.getByLabel("校验已有备份（仅在本机读取）")).toHaveValue("");
  await page.goto("/archive");
  await expect(
    page.getByRole("heading", { name: "过去，仍在与你对话" }),
  ).toBeVisible();
});

test("backup: server failure, corrupted transport, then retry; never offer partial download", async ({
  page,
}) => {
  await mockAPI(page);
  const bytes = await backupBytes();
  let mode = 0;
  await page.route("**/api/backups/export", (route) =>
    mode === 0
      ? route.fulfill({
          status: 503,
          json: { error: { message: "合成服务故障，完整备份未生成。" } },
        })
      : route.fulfill({
          contentType: "application/zip",
          body: mode === 1 ? bytes.subarray(0, bytes.length - 22) : bytes,
        }),
  );
  await page.goto("/settings");
  await page.getByLabel(consent).check();
  await page.getByRole("button", { name: generate }).click();
  await expect(page.locator(".backup-panel").getByRole("alert")).toContainText(
    "完整备份未生成",
  );
  await expect(page.getByRole("link", { name: "保存备份文件" })).toHaveCount(0);
  mode = 1;
  await page.getByRole("button", { name: generate }).click();
  await expect(page.locator(".backup-panel").getByRole("alert")).toContainText(
    "ZIP",
  );
  await expect(page.getByRole("link", { name: "保存备份文件" })).toHaveCount(0);
  mode = 2;
  await page.getByRole("button", { name: generate }).click();
  await expect(page.getByRole("link", { name: "保存备份文件" })).toBeVisible();
});

test("backup: cancelling an in-flight export clears result and prevents duplicate submission", async ({
  page,
}) => {
  await mockAPI(page);
  let calls = 0;
  await page.route("**/api/backups/export", async (route) => {
    calls++;
    await new Promise((r) => setTimeout(r, 1200));
    await route.abort().catch(() => {});
  });
  await page.goto("/settings");
  await page.getByLabel(consent).check();
  await page.getByRole("button", { name: generate }).click();
  await expect(page.getByRole("button", { name: generate })).toBeDisabled();
  await page.getByRole("button", { name: "取消本次操作" }).click();
  await expect(
    page.getByText("已取消或清除本次文件选择，云端内容未改变。"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "保存备份文件" })).toHaveCount(0);
  expect(calls).toBeLessThanOrEqual(1);
});

test("backup: local legacy or damaged file refused without any backup API request", async ({
  page,
}) => {
  await mockAPI(page);
  let requests = 0;
  await page.route("**/api/backups/**", (route) => {
    requests++;
    return route.abort();
  });
  await page.goto("/settings");
  await page.getByLabel("校验已有备份（仅在本机读取）").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"records":[]}'),
  });
  await expect(page.locator(".backup-panel").getByRole("alert")).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole("link", { name: "保存备份文件" })).toHaveCount(0);
});

test("backup API: actual route denies cross-origin and anonymous access before export", async ({
  request,
}) => {
  const cross = await request.post("/api/backups/export", {
    headers: { Origin: "https://example.test" },
  });
  expect(cross.status()).toBe(403);
  expect((await cross.json()).error.code).toBe("ORIGIN_REJECTED");
  const anon = await request.post("/api/backups/export", {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  expect([401, 503]).toContain(anon.status());
  expect(["LOGIN_REQUIRED", "NOT_CONFIGURED"]).toContain(
    (await anon.json()).error.code,
  );
  expect(anon.headers()["cache-control"]).toContain("no-store");
});

test("backup: logout clears prepared download and private summary", async ({
  page,
}) => {
  await mockAPI(page);
  const bytes = await backupBytes();
  let loggedIn = true;
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        data: {
          configured: true,
          authenticated: loggedIn,
          email: loggedIn ? "synthetic@example.test" : undefined,
        },
      },
    }),
  );
  await page.route("**/api/auth/logout", (route) => {
    loggedIn = false;
    return route.fulfill({ json: { data: {} } });
  });
  await page.route("**/api/backups/export", (route) =>
    route.fulfill({ contentType: "application/zip", body: bytes }),
  );
  await page.goto("/settings");
  await page.getByLabel(consent).check();
  await page.getByRole("button", { name: generate }).click();
  await expect(page.getByRole("link", { name: "保存备份文件" })).toBeVisible();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.getByRole("link", { name: "保存备份文件" })).toHaveCount(0);
  await expect(page.locator(".backup-summary")).toHaveCount(0);
});

test("backup: delayed initial session cannot discard a newly selected local file", async ({
  page,
}) => {
  await mockAPI(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/session", async (route) => {
    await gate;
    await route.fulfill({
      json: {
        data: {
          configured: true,
          authenticated: true,
          email: "synthetic@example.test",
        },
      },
    });
  });
  try {
    await page.goto("/settings");
    await expect(
      page.getByText("正在确认会话，随后可导出或在本机校验备份…"),
    ).toBeVisible();
    await expect(page.getByLabel("校验已有备份（仅在本机读取）")).toHaveCount(
      0,
    );
  } finally {
    release();
  }
  await page.getByLabel("校验已有备份（仅在本机读取）").setInputFiles({
    name: "invalid.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator(".backup-panel").getByRole("alert")).toBeVisible();
});
