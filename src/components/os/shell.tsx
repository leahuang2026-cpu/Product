"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  Archive,
  Sprout,
  BookOpen,
  Focus,
  Plus,
  Search,
  Settings,
  LockKeyhole,
} from "lucide-react";
import { useOS } from "./context";
import { Dialog } from "./common";
import { Composer } from "./composer";
import type { ReactNode } from "react";
const links = [
  { path: "/", name: "关注", en: "Focus", icon: Focus },
  { path: "/archive", name: "档案", en: "Archive", icon: Archive },
  { path: "/direction", name: "方向", en: "Direction", icon: Compass },
  { path: "/ideas", name: "灵感", en: "Idea Garden", icon: Sprout },
  { path: "/reflection", name: "复盘", en: "Reflection", icon: BookOpen },
];
export function OSShell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    router = useRouter();
  const { composer, setComposer, session, navigate } = useOS();
  const current = links.find((l) =>
    l.path === "/"
      ? path === "/" || path === "/focus"
      : path.startsWith(l.path),
  );
  function capture() {
    if (path === "/" || path === "/focus" || path === "/capture") {
      const input = document.getElementById("capture-text");
      if (input) {
        input.focus();
        input.scrollIntoView({ block: "center", behavior: "auto" });
      } else setComposer(true);
    } else setComposer(true);
  }
  function navigation(mobile: boolean) {
    return (
      <nav
        className={mobile ? "bottom-nav" : "desktop-nav"}
        aria-label={mobile ? "手机主导航" : "主导航"}
      >
        {links.map(({ path: href, name, en, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={current?.path === href ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate(() => router.push(href));
            }}
          >
            <Icon size={18} />
            <span>
              {name}
              <small>{en}</small>
            </span>
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <div className="personal-os">
      <a href="#main" className="skip-link">
        跳转到内容
      </a>
      <header className="os-topbar">
        <div className="topbar-inner">
          <Link
            href="/"
            className="brand"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate(() => router.push("/"));
            }}
          >
            <span className="brand-mark" aria-hidden="true">
              p
            </span>
            <span>
              Personal OS<small>你的记录，慢慢成为你的坐标。</small>
            </span>
          </Link>
          <div className="topbar-actions">
            <span className="private-label">
              <LockKeyhole size={13} />
              仅自己可见
              <span className="session-label">
                {session?.authenticated
                  ? "已登录"
                  : session?.configured
                    ? "待登录"
                    : "尚未连接"}
              </span>
            </span>
            <button
              className="icon-button header-search"
              aria-label="搜索记录"
              onClick={() =>
                navigate(() => {
                  router.push("/archive");
                  setTimeout(
                    () => document.getElementById("archive-search")?.focus(),
                    150,
                  );
                })
              }
            >
              <Search size={18} />
            </button>
            <button
              className="button secondary capture-global"
              onClick={capture}
              aria-label="记录此刻"
            >
              <Plus size={17} />
              <span>记录此刻</span>
            </button>
            <Link
              className="account-link"
              aria-label="隐私与设置"
              href="/settings"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate(() => router.push("/settings"));
              }}
            >
              <Settings size={18} />
              <span>账户</span>
            </Link>
          </div>
        </div>
      </header>
      <div className="os-main">
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer>
          <span>
            Memory 过去的沉淀<span className="footer-divider"> / </span>Focus
            现在的关注<span className="footer-divider"> / </span>Direction
            未来的方向
          </span>
          <small>让记录成为理解自己的线索。</small>
        </footer>
      </div>
      {navigation(false)}
      {navigation(true)}
      {composer && (
        <Dialog
          title="记录此刻"
          onClose={() => navigate(() => setComposer(false))}
        >
          <Composer onDone={() => setComposer(false)} />
        </Dialog>
      )}
    </div>
  );
}
