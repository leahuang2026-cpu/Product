import { AppState } from "./domain";
export function seedState(): AppState {
  const now = new Date();
  const ago = (n: number) =>
    new Date(now.getTime() - n * 86400000).toISOString();
  return {
    version: 1,
    records: [
      {
        id: "r1",
        title: "留一点空白，给真正重要的事",
        raw: "今天散步时想到：日程里留出的空白，并不是浪费。有些想法只有慢下来才会出现。比起把一天填满，我更想知道哪些事值得反复投入。",
        domain: "自我",
        kind: "text",
        tags: ["日常觉察", "慢下来"],
        createdAt: ago(0),
        ai: null,
      },
      {
        id: "r2",
        title: "关于长期主义的一次小小实践",
        raw: "把读书从年度数字目标变成一个固定的周末时段。读完后，只留下一个能和自己经历产生联系的问题。",
        domain: "能力",
        kind: "text",
        tags: ["阅读", "学习方法"],
        createdAt: ago(1),
        ai: null,
      },
      {
        id: "r3",
        title: "和家人一起做一顿晚饭",
        raw: "周末试着把手机放到一边，和家人一起备菜、做饭。普通的一餐，也可以是值得记住的一天。",
        domain: "生活",
        kind: "text",
        tags: ["生活片段"],
        createdAt: ago(2),
        ai: null,
      },
    ],
    goals: [
      {
        id: "g1",
        title: "成为能独立创造产品的人",
        why: "用自己的观察与技能，做出真正对他人有用的东西。",
        domain: "职业",
        horizon: "未来 1–3 年",
        createdAt: ago(30),
      },
      {
        id: "g2",
        title: "建立从容、可持续的生活节奏",
        why: "为健康、关系和独处留出稳定的空间。",
        domain: "生活",
        horizon: "长期方向",
        createdAt: ago(30),
      },
      {
        id: "g3",
        title: "建立自己的财务安全感",
        why: "看懂日常收支，为选择保留余地。",
        domain: "财富",
        horizon: "未来 1 年",
        createdAt: ago(20),
      },
    ],
    projects: [
      {
        id: "p1",
        goalId: "g1",
        title: "打磨第一个个人产品",
        domain: "职业",
        note: "从一个真实的小问题开始，做出可以使用的原型。",
        actions: [
          { id: "a1", title: "写下产品想解决的一个核心问题", done: true },
          { id: "a2", title: "和一位潜在用户聊聊他的日常", done: false },
          { id: "a3", title: "画出最简单的使用流程", done: false },
        ],
      },
      {
        id: "p2",
        goalId: "g2",
        title: "找回阅读与散步的节奏",
        domain: "自我",
        note: "给思绪一点不被打扰的时间。",
        actions: [
          { id: "a4", title: "选一本此刻真正想读的书", done: true },
          { id: "a5", title: "安排一次没有目的地的散步", done: false },
        ],
      },
    ],
    ideas: [
      {
        id: "i1",
        title: "一份写给未来自己的通讯",
        body: "每个月留下一封短信，记录当下相信的事、困惑的事，以及那些不想忘记的瞬间。",
        domain: "自我",
        status: "seed",
        createdAt: ago(1),
      },
      {
        id: "i2",
        title: "城市里的安静地图",
        body: "收集适合独处、阅读和散步的地方。也许只是一张属于自己的地图。",
        domain: "生活",
        status: "exploring",
        createdAt: ago(3),
      },
      {
        id: "i3",
        title: "把知识画成小卡片",
        body: "尝试用一张图解释最近学到的概念。暂时不用决定是否公开。",
        domain: "能力",
        status: "paused",
        createdAt: ago(5),
      },
    ],
    reflections: [],
    suggestions: [
      {
        id: "s1",
        goalId: "g1",
        proposedTitle: "通过一个真实项目，练习独立创造产品",
        reason:
          "示例建议：把抽象方向描述得更贴近你当前的探索。只有你确认后，方向才会改变。",
        status: "pending",
        decidedAt: null,
      },
    ],
  };
}
