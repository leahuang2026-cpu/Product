import { test, expect } from "@playwright/test";
import { mockAPI } from "./fixtures";
test("五模块在各宽度可访问，无横向溢出；实际渲染截图（合成 API）", async ({
  page,
}) => {
  const api = await mockAPI(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/archive",
    "/direction",
    "/ideas",
    "/reflection",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  api.entries.push({
    id: "33333333-3333-4333-8333-333333333333",
    kind: "focus",
    title: "给自己的记录，找一个长久的家",
    body: "保留那些让我停下来思考的时刻。先从每天真正想留下的内容开始。",
    domains: ["自我", "能力"],
    next: "整理一条过去的笔记，看看当时在意什么。",
    relationId: null,
    sourceIds: [],
    active: true,
    version: 1,
  });
  await page.goto("/");
  await expect(page.getByLabel("记录内容")).toBeVisible();
  await page.screenshot({
    path: `/tmp/personal-os-ui-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("先保存后多选分类，跨模块保留领域；取消灵感不删原文", async ({ page }) => {
  const api = await mockAPI(page);
  await page.goto("/capture");
  await page.getByLabel("记录内容").fill("  保留原始空白\n我的想法  ");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("内容已保存，可稍后整理。")).toBeVisible();
  const fields = page.getByRole("group", { name: /为这条记录补充领域/ });
  await fields.getByRole("button", { name: "职业", exact: true }).click();
  await fields.getByRole("button", { name: "能力", exact: true }).click();
  await page.getByRole("button", { name: "保存领域", exact: true }).click();
  await expect(page.getByText("领域已保存。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "留在灵感库", exact: true }).click();
  await expect(page.getByText("已留在灵感库。", { exact: true })).toBeVisible();
  expect(api.records.at(-1)?.originalText).toBe("  保留原始空白\n我的想法  ");
  await page.goto("/ideas");
  await page.getByRole("button").filter({ hasText: "保留原始空白" }).click();
  await page.getByRole("button", { name: "取消灵感标记", exact: true }).click();
  await expect(page.getByText("已取消标记，原文仍在档案中。")).toBeVisible();
  expect(api.records.at(-1)?.isIdea).toBe(false);
  expect(api.records).toHaveLength(3);
});
test("多选任一匹配、清除筛选、详情返回焦点和未分类", async ({ page }) => {
  await mockAPI(page);
  await page.goto("/archive");
  const fields = page.locator(".global-domains");
  await fields.getByRole("button", { name: "能力", exact: true }).click();
  await fields.getByRole("button", { name: "财富", exact: true }).click();
  await expect(page.locator(".record-card")).toHaveCount(1);
  await page.locator(".record-card").click();
  await page.getByRole("button", { name: "返回列表" }).click();
  await expect(page.locator(".record-card")).toBeFocused();
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(page.locator(".record-card")).toHaveCount(2);
  await page.getByLabel("只看未分类").check();
  await expect(page.getByText("没有匹配的记录", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除条件", exact: true }).click();
  await expect(page.locator(".record-card")).toHaveCount(2);
});
test("关闭采集先确认，取消保留输入；键盘 Escape 和焦点恢复", async ({
  page,
}) => {
  await mockAPI(page);
  await page.goto("/archive");
  await page
    .locator("main")
    .getByRole("button", { name: "记录此刻", exact: true })
    .click();
  await page.getByLabel("记录内容").fill("尚未保存的内容");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("记录内容")).toHaveValue("尚未保存的内容");
  page.once("dialog", (dialog) => dialog.accept());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("main").getByRole("button", { name: "记录此刻", exact: true }),
  ).toBeFocused();
});
test("Focus 关联和下一步可空，复盘没有材料也可手写", async ({ page }) => {
  const api = await mockAPI(page);
  await page.goto("/");
  await page.getByRole("button", { name: "添加关注" }).click();
  await page.getByLabel("为什么在意").fill("让生活多一点空间");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(page.getByText("还没有填写，慢慢来。")).toBeVisible();
  expect(api.entries[0].relationId).toBe(null);
  await page.goto("/reflection");
  await page.getByRole("button", { name: "写复盘" }).click();
  await page
    .getByLabel("这段时间，想对自己说些什么")
    .fill("没有结论也值得记录。");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(page.locator(".entry-card")).toContainText(
    "没有结论也值得记录。",
  );
  expect(api.entries.at(-1)?.sourceIds).toEqual([]);
});

test("领域跨模块保留，模块搜索条件不会泄漏", async ({ page }) => {
  await mockAPI(page);
  await page.goto("/archive");
  await page
    .locator(".global-domains")
    .getByRole("button", { name: "能力", exact: true })
    .click();
  await page.getByRole("textbox", { name: "搜索记录" }).fill("数据库");
  const nav =
    page.viewportSize()!.width <= 960
      ? page.getByRole("navigation", { name: "手机主导航" })
      : page.getByRole("navigation", { name: "主导航", exact: true });
  await nav.getByRole("link", { name: /灵感/ }).click();
  await expect(
    page
      .locator(".global-domains")
      .getByRole("button", { name: "能力", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "搜索记录" })).toHaveValue("");
  await expect(page.locator(".idea-note")).toHaveCount(1);
});

test("复盘新建跟随周月页签，切换周期保存后显示在对应列表，刷新不丢失", async ({
  page,
}) => {
  const api = await mockAPI(page);
  await page.goto("/reflection");
  const weekly = page.getByRole("button", { name: "周度复盘", exact: true });
  const monthly = page.getByRole("button", { name: "月度复盘", exact: true });
  const write = page.getByRole("button", { name: "写复盘", exact: true });
  const cards = page.locator(".entry-card");
  await monthly.click();
  await write.click();
  await expect(page.getByLabel("复盘周期")).toHaveValue("monthly");
  await page.getByLabel("这段时间，想对自己说些什么").fill("虚构月度回望");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(cards).toContainText("虚构月度回望");
  expect(api.entries[0].cadence).toBe("monthly");
  await weekly.click();
  await expect(cards).toHaveCount(0);
  await write.click();
  await expect(page.getByLabel("复盘周期")).toHaveValue("weekly");
  await page
    .getByLabel("这段时间，想对自己说些什么")
    .fill("虚构第二次月度回望");
  await page.getByLabel("复盘周期").selectOption("monthly");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(monthly).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(2);
  await cards
    .filter({ hasText: "虚构第二次月度回望" })
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await expect(page.getByLabel("复盘周期")).toHaveValue("monthly");
  await page.getByLabel("复盘周期").selectOption("weekly");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(weekly).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(1);
  await page.reload();
  await expect(cards).toContainText("虚构第二次月度回望");
  await monthly.click();
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("虚构月度回望");
});
