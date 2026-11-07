"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowUpRight, Sprout } from "lucide-react";
import Link from "next/link";
import { Domain } from "@/lib/domain";
export function Tag({ domain }: { domain: Domain }) {
  return <span className={`tag domain-${domain}`}>{domain}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Sprout size={30} />
      <h3>{title}</h3>
      <p>{children || "不用着急，从一个小小的念头开始。"}</p>
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
export function More({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="关闭弹窗" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
