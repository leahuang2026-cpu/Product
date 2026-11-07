"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  House,
  Archive,
  ScanLine,
  Compass,
  Sprout,
  BookOpen,
  Plus,
  Search,
  Menu,
  X,
  ArrowUpRight,
  Settings,
  LockKeyhole,
  CircleDot,
} from "lucide-react";
import { useStore } from "./store";
const links = [
  { path: "/", name: "我的空间", english: "Overview", icon: House },
  { path: "/archive", name: "人生档案", english: "Archive", icon: Archive },
  { path: "/focus", name: "当下关注", english: "Focus", icon: ScanLine },
  { path: "/direction", name: "未来方向", english: "Direction", icon: Compass },
  { path: "/ideas", name: "灵感花园", english: "Idea Garden", icon: Sprout },
  {
    path: "/reflection",
    name: "定期复盘",
    english: "Reflection",
    icon: BookOpen,
  },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { error } = useStore();
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        跳转到主内容
      </a>
      {open && (
        <button
          className="nav-overlay"
          aria-label="关闭导航"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="主导航">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-symbol">
            <Sprout size={23} />
          </span>
          <span>
            Personal OS<small>A SPACE TO BECOME</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="关闭导航"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <Link
          href="/capture"
          className="capture-nav"
          onClick={() => setOpen(false)}
        >
          <Plus size={18} /> 随手记一笔 <span>↗</span>
        </Link>
        <p className="nav-label">你的生活，慢慢展开</p>
        <nav>
          {links.map(({ path: href, name, english, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              className={`nav-item ${path === href ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>
                {name}
                <small>{english}</small>
              </span>
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <span>“</span>
            <p>
              不必每一步都有答案，
              <br />
              留下来，就有了脉络。
            </p>
            <div className="tiny-line" />
          </div>
          <Link
            className={`nav-item settings-link ${path === "/settings" ? "active" : ""}`}
            href="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings size={18} />
            数据与设置
          </Link>
          <div className="profile">
            <span className="avatar">我</span>
            <div>
              我的个人空间
              <small>
                <LockKeyhole size={10} /> 仅保存在此浏览器
              </small>
            </div>
            <ArrowUpRight size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="menu-button icon-button"
              aria-label="打开导航"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>我的空间</span>
            <span className="slash">/</span>
            <strong>
              {links.find((x) => x.path === path)?.name ||
                (path === "/capture" ? "随手记录" : "数据与设置")}
            </strong>
          </div>
          <div className="top-actions">
            <span className="local-status">
              <CircleDot size={12} /> 本地体验版
            </span>
            <Link href="/archive" className="icon-button" aria-label="搜索档案">
              <Search size={19} />
            </Link>
            <span className="top-avatar">我</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {error && (
            <div role="alert" className="error-banner">
              {error} <Link href="/settings">前往数据设置 →</Link>
            </div>
          )}
          {children}
        </main>
        <footer className="footer">
          <span>PERSONAL OS</span>
          <span>按照自己的节奏，慢慢生长。</span>
          <span>
            <LockKeyhole size={11} /> 你的记录，由你掌握
          </span>
        </footer>
      </div>
    </div>
  );
}
