import type { Metadata } from "next";
import { OSProvider } from "@/components/os/context";
import { OSShell } from "@/components/os/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Personal OS · 留下生活的脉络",
    template: "%s · Personal OS",
  },
  description:
    "过去的沉淀、现在的关注、未来的方向。一个由你掌握的个人知识与人生档案。",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <OSProvider>
          <OSShell>{children}</OSShell>
        </OSProvider>
      </body>
    </html>
  );
}
