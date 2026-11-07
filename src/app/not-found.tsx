import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>这条小路还没有延伸到这里</h1>
      <p>回到首页，继续整理生活的脉络。</p>
      <Link className="button primary" href="/">
        返回首页
      </Link>
    </div>
  );
}
