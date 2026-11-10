import { test, expect, type Page } from "@playwright/test";
import { mockAPI, one } from "./fixtures";
import type { Entry } from "../../src/lib/os/model";
const accept = (page: Page) => page.once("dialog", (d) => d.accept());
const entry = (id: string, kind: Entry["kind"], title: string): Entry => ({
  id,
  kind,
  title,
  body: "虚构内容",
  domains: [],
  next: "",
  relationId: null,
  sourceIds: [],
  active: true,
  version: 1,
});

test("记录移入取消、失败、丢响应重试与恢复；Garden 和来源同步，原图保留", async ({
  page,
}) => {
  const api = await mockAPI(page);
  api.records[0].isIdea = true;
  api.records[0].attachments = [
    {
      id: "77777777-7777-4777-8777-777777777777",
      name: "synthetic.png",
      mime: "image/png",
      bytes: 80,
      contentPath:
        "/api/attachments/77777777-7777-4777-8777-777777777777/content",
    },
  ];
  api.entries.push({
    ...entry("66666666-6666-4666-8666-666666666666", "reflection", "来源测试"),
    cadence: "weekly",
    sourceIds: [one],
  });
  const original = structuredClone(api.records[0]);
  await page.goto("/archive");
  await page
    .locator(".record-card")
    .filter({ hasText: "给生活留一点空白" })
    .click();
  await page.getByLabel("补充说明").fill("尚未保存的虚构说明");
  page.once("dialog", (d) => d.dismiss());
  await page
    .locator(".reading-pane")
    .getByRole("link", { name: "查看回收站", exact: true })
    .click();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByLabel("补充说明")).toHaveValue("尚未保存的虚构说明");
  await page.getByLabel("补充说明").fill("");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  expect(api.trashPosts).toHaveLength(0);
  api.failTrash = true;
  accept(page);
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await expect(
    page.getByText("服务暂不可用，内容未移动，请重试。"),
  ).toBeVisible();
  expect(api.records.some((r) => r.id === one)).toBe(true);
  api.failTrash = false;
  api.dropTrashResponse = true;
  accept(page);
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await expect(
    page.getByText("尚未确认保存或读取结果，请重试。当前输入仍保留。"),
  ).toBeVisible();
  accept(page);
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await expect(page.locator(".reading-pane")).toHaveCount(0);
  expect(api.trashPosts).toHaveLength(3);
  expect(new Set(api.trashPosts.map((p) => p.key)).size).toBe(1);
  await page.goto("/ideas");
  await expect(
    page.locator(".record-card").filter({ hasText: "给生活留一点空白" }),
  ).toHaveCount(0);
  await page.goto("/reflection");
  await expect(
    page.getByText("来源 1 已移入回收站或暂不可用；引用关系保留。"),
  ).toBeVisible();
  await page.goto(`/archive/${one}`);
  await expect(
    page.getByText("此记录已移入回收站。可在设置的回收站中恢复。"),
  ).toBeVisible();
  await page.goto("/settings#trash");
  const card = page
    .locator("#trash .entry-card")
    .filter({ hasText: "给生活留一点空白" });
  page.once("dialog", (d) => d.dismiss());
  await card.getByRole("button", { name: "恢复", exact: true }).click();
  expect(api.trashedRecords).toHaveLength(1);
  api.failTrash = true;
  accept(page);
  await card.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(
    card.getByText("服务暂不可用，内容未移动，请重试。"),
  ).toBeVisible();
  expect(api.trashedRecords).toHaveLength(1);
  api.failTrash = false;
  await expect(
    page.getByRole("button", { name: "永久删除", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  accept(page);
  await card.getByRole("button", { name: "恢复", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("已恢复。可回到原模块查看，原有内容和关联保留。"),
  ).toBeVisible();
  expect({
    ...api.records.find((r) => r.id === one),
    version: original.version,
  }).toEqual(original);
  await page.goto("/ideas");
  await expect(
    page.locator(".record-card").filter({ hasText: "给生活留一点空白" }),
  ).toBeVisible();
  await page.goto("/reflection");
  await expect(page.getByRole("link", { name: "查看来源 1" })).toBeVisible();
});

test("方向有 Focus 引用时保留，手动解除后移入；复盘恢复保留周期和来源", async ({
  page,
}) => {
  const api = await mockAPI(page);
  const direction = entry(
    "33333333-3333-4333-8333-333333333333",
    "direction",
    "虚构方向",
  );
  api.entries.push(
    direction,
    {
      ...entry("44444444-4444-4444-8444-444444444444", "focus", "虚构关注"),
      relationId: direction.id,
      active: false,
    },
    {
      ...entry(
        "55555555-5555-4555-8555-555555555555",
        "reflection",
        "虚构月度复盘",
      ),
      cadence: "monthly",
      sourceIds: [one],
    },
  );
  await page.goto("/direction");
  accept(page);
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await expect(
    page.getByText(
      "此方向仍有关联关注，请先编辑关联关注，解除关联后重试。内容未移动。",
    ),
  ).toBeVisible();
  expect(api.entries.some((e) => e.id === direction.id)).toBe(true);
  await page.getByRole("button", { name: /编辑关联关注：虚构关注/ }).click();
  await page.getByLabel("关联方向（可空）").selectOption("");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  accept(page);
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await expect(page.locator(".entry-card")).toHaveCount(0);
  await page.goto("/settings#trash");
  accept(page);
  await page
    .locator("#trash .entry-card")
    .filter({ hasText: "虚构方向" })
    .getByRole("button", { name: "恢复", exact: true })
    .click();
  await expect(page.locator("#trash .entry-card")).toHaveCount(0);
  await page.goto("/reflection");
  await page.getByRole("button", { name: "月度复盘", exact: true }).click();
  accept(page);
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await expect(page.locator(".entry-card")).toHaveCount(0);
  expect(api.records).toHaveLength(2);
  await page.goto("/settings#trash");
  accept(page);
  await page
    .locator("#trash .entry-card")
    .filter({ hasText: "虚构月度复盘" })
    .getByRole("button", { name: "恢复", exact: true })
    .click();
  await expect(page.locator("#trash .entry-card")).toHaveCount(0);
  await page.goto("/reflection");
  await expect(page.locator(".entry-card")).toHaveCount(0);
  await page.getByRole("button", { name: "月度复盘", exact: true }).click();
  await expect(page.locator(".entry-card")).toContainText("虚构月度复盘");
  await expect(page.getByRole("link", { name: "查看来源 1" })).toBeVisible();
});

test("数据库回收站未安装时显示真实错误，不隐藏原记录", async ({ page }) => {
  const api = await mockAPI(page);
  api.trashUnavailable = true;
  await page.goto("/archive");
  await page
    .locator(".record-card")
    .filter({ hasText: "给生活留一点空白" })
    .click();
  accept(page);
  await page.getByRole("button", { name: "移入回收站", exact: true }).click();
  await expect(page.getByText("回收站尚未接通，内容未移动。")).toBeVisible();
  expect(api.records).toHaveLength(2);
  await page.goto("/settings#trash");
  await expect(page.getByText("回收站尚未接通，内容未移动。")).toBeVisible();
  // Let the initial session/data requests finish before bringing the mock backend
  // online; otherwise the initial reread can remove Retry before it is clicked.
  await page.waitForLoadState("networkidle");
  await expect(
    page.locator("#trash").getByText("回收站尚未接通，内容未移动。"),
  ).toBeVisible();
  api.trashUnavailable = false;
  await page
    .locator("#trash")
    .getByRole("button", { name: "重试", exact: true })
    .click();
  await expect(page.getByText("回收站是空的")).toBeVisible();
});
