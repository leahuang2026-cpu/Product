import { test, expect } from "@playwright/test";
import { mockAPI, png, one } from "./fixtures";
import { seedState } from "../../src/lib/seed";
test("图片上传失败保留正文、重试和原图详情", async ({ page }) => {
  const api = await mockAPI(page);
  await page.goto("/capture");
  await page.getByLabel("记录内容").fill("正文不能因为附件失败而丢失");
  await page
    .getByLabel("图片文件")
    .setInputFiles({ name: "memory.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "memory.png" })).toBeVisible();
  api.failUpload = true;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "图片尚未保存",
  );
  await expect(page.getByLabel("记录内容")).toHaveValue(
    "正文不能因为附件失败而丢失",
  );
  api.failUpload = false;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("内容已保存，可稍后整理。")).toBeVisible();
  await page.getByRole("link", { name: "查看记录", exact: true }).click();
  const image = page.getByRole("img", { name: "memory.png" });
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1);
});
test("响应丢失后同一 ID 重试，记录不重复；空白不能提交", async ({ page }) => {
  const api = await mockAPI(page);
  await page.goto("/capture");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "请写下内容或添加附件",
  );
  expect(api.posts).toHaveLength(0);
  await page.getByLabel("记录内容").fill("请求结果未知也不能重复记录");
  api.dropResponse = true;
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "尚未确认",
  );
  await page.getByRole("button", { name: "重试保存", exact: true }).click();
  await expect(page.getByText("内容已保存，可稍后整理。")).toBeVisible();
  expect(api.posts).toHaveLength(2);
  expect(new Set(api.posts).size).toBe(1);
  expect(api.records).toHaveLength(3);
});
test("分类失败原文仍在；读取失败与无匹配有不同出口", async ({ page }) => {
  const api = await mockAPI(page);
  await page.goto(`/archive/${one}`);
  await page
    .getByRole("group", { name: /记录领域/ })
    .getByRole("button", { name: "职业", exact: true })
    .click();
  api.failMetadata = true;
  await page.getByRole("button", { name: "保存说明与领域" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("未保存");
  expect(api.records[0].domains).toEqual(["生活"]);
  await expect(page.locator(".original-content")).toContainText(
    "给生活留一点空白",
  );
  api.readError = true;
  await page.goto("/archive");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "读取失败",
  );
  await expect(page.getByText("没有匹配的记录", { exact: true })).toHaveCount(
    0,
  );
  api.readError = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索记录" }).fill("不存在的匹配词");
  await expect(page.getByText("没有匹配的记录", { exact: true })).toBeVisible();
});
test("旧档案只读且不迁移，原始备份可导出", async ({ page }) => {
  await mockAPI(page);
  const state = seedState();
  await page.addInitScript(
    (value) => localStorage.setItem("personal-os:v1", value),
    JSON.stringify(state),
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "查看旧版档案" }).click();
  await expect(page.getByText("3 条记录 · 3 条旧版灵感")).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("personal-os:v1")!),
    ),
  ).toEqual(state);
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出旧版原始备份" }).click();
  const download = await wait;
  expect(download.suggestedFilename()).toBe("personal-os-legacy-backup.json");
  await expect(page.getByRole("button", { name: /清空|确认替换/ })).toHaveCount(
    0,
  );
});
test("真实应用端点默认拒绝匿名和跨来源写入（不调用云写入）", async ({
  request,
}) => {
  for (const path of [
    "/api/records",
    `/api/records/${one}`,
    `/api/attachments/${one}/content`,
    "/api/entries",
  ]) {
    const result = await request.get(path);
    expect([401, 503]).toContain(result.status());
    const body = await result.json();
    expect(body).not.toHaveProperty("data");
  }
  const denied = await request.post("/api/records", {
    headers: { Origin: "https://untrusted.example" },
    data: { originalText: "test" },
  });
  expect(denied.status()).toBe(403);
});

test("文字与图片链接混合添加，逐个移除不清空正文", async ({ page }) => {
  const api = await mockAPI(page);
  await page.goto("/capture");
  await page.getByLabel("记录内容").fill("混合材料仍是一条记录");
  await page.getByLabel("图片文件").setInputFiles([
    { name: "first.png", mimeType: "image/png", buffer: png },
    { name: "second.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.locator(".draft-file")).toHaveCount(2);
  await page
    .getByRole("button", { name: "移除 first.png", exact: true })
    .click();
  await expect(page.locator(".draft-file")).toHaveCount(1);
  await page.getByRole("button", { name: "添加链接", exact: true }).click();
  await page.getByLabel("链接地址").fill("https://example.com/notes");
  await page
    .locator(".link-input")
    .getByRole("button", { name: "添加链接", exact: true })
    .click();
  await expect(page.getByLabel("记录内容")).toHaveValue("混合材料仍是一条记录");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("内容已保存，可稍后整理。")).toBeVisible();
  expect(api.records.at(-1)?.attachments).toHaveLength(1);
  expect(api.records.at(-1)?.links).toEqual(["https://example.com/notes"]);
});
