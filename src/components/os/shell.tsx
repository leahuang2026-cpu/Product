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
import { DomainPicker, Dialog } from "./common";
import { Composer } from "./composer";
import type { ReactNode } from "react";
const links = [
  { path: "/", name: "现在", en: "Focus", icon: Focus },
  { path: "/archive", name: "过去", en: "Archive", icon: Archive },
  { path: "/direction", name: "未来", en: "Direction", icon: Compass },
  { path: "/ideas", name: "灵感", en: "Idea Garden", icon: Sprout },
  { path: "/reflection", name: "复盘", en: "Reflection", icon: BookOpen },
];
export function OSShell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    router = useRouter();
  const { domains, setDomains, composer, setComposer, session, navigate } =
    useOS();
  const current = links.find((l) =>
    l.path === "/"
      ? path === "/" || path === "/focus"
      : path.startsWith(l.path),
  );
  function capture() {
    if (path === "/" || path === "/focus" || path === "/capture")
      document.getElementById("capture-text")?.focus();
    else setComposer(true);
  }
  return (
    <div className="personal-os">
      <a href="#main" className="skip-link">
        跳转到内容
      </a>
      <aside className="os-sidebar">
        <Link
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate(() => router.push("/"));
          }}
        >
          <span className="brand-mark">
            <Sprout size={24} />
          </span>
          <span>
            Personal OS<small>给生活，留下自己的脉络</small>
          </span>
        </Link>
        <button className="button primary capture-global" onClick={capture}>
          <Plus size={19} />
          记录此刻
        </button>
        <nav aria-label="主导航">
          {links.map(({ path: href, name, en, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={current?.path === href ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(() => router.push(href));
              }}
            >
              <Icon size={19} />
              <span>
                {name}
                <small>{en}</small>
              </span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p>
            过去的沉淀
            <br />
            现在的关注
            <br />
            未来的方向
          </p>
          <Link
            href="/settings"
            onClick={(e) => {
              e.preventDefault();
              navigate(() => router.push("/settings"));
            }}
          >
            <Settings size={17} />
            隐私与设置
          </Link>
          <span>
            <LockKeyhole size={13} />
            仅属于你的私人空间
          </span>
        </div>
      </aside>
      <div className="os-main">
        <header className="os-topbar">
          <span>
            {current?.en || "Personal OS"}
            <span className="breadcrumb-dot"> / </span>
            {current?.name || "私人空间"}
          </span>
          <div>
            <span className="session-label">
              {session?.authenticated
                ? "已登录"
                : session?.configured
                  ? "待登录"
                  : "尚未连接"}
            </span>
            <button
              className="icon-button"
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
              <Search size={19} />
            </button>
            <button
              className="icon-button mobile-capture"
              aria-label="记录此刻"
              onClick={capture}
            >
              <Plus size={21} />
            </button>
            <Link
              className="icon-button"
              aria-label="隐私与设置"
              href="/settings"
              onClick={(e) => {
                e.preventDefault();
                navigate(() => router.push("/settings"));
              }}
            >
              <Settings size={19} />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {path !== "/settings" && path !== "/login" && (
            <div className="global-domains">
              <DomainPicker
                value={domains}
                onChange={setDomains}
                label="当前领域"
              />
            </div>
          )}
          {children}
        </main>
        <footer>让记录成为理解自己的线索。</footer>
      </div>
      <nav className="bottom-nav" aria-label="手机主导航">
        {links.map(({ path: href, name, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={current?.path === href ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(() => router.push(href));
            }}
          >
            <Icon size={20} />
            <span>{name}</span>
          </Link>
        ))}
      </nav>
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
