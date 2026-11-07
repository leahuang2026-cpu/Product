import { notFound } from "next/navigation";
import { OSWorkspace } from "@/components/os/workspace";
const pages = {
  login: "私人登录",
  capture: "随手记录",
  archive: "人生档案",
  focus: "当下关注",
  direction: "未来方向",
  ideas: "灵感花园",
  reflection: "定期复盘",
  settings: "数据与设置",
};
export function generateStaticParams() {
  return Object.keys(pages).map((section) => ({ section }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return { title: pages[section as keyof typeof pages] || "未找到页面" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!Object.hasOwn(pages, section)) notFound();
  return <OSWorkspace section={section} />;
}
