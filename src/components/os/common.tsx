"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, RefreshCw } from "lucide-react";
import { domains, type Domain } from "@/lib/os/model";
import { useOS } from "./context";
export function GlobalDomains() {
  const { domains, setDomains } = useOS();
  return (
    <div className="global-domains">
      <DomainPicker value={domains} onChange={setDomains} label="当前领域" />
    </div>
  );
}
export function DomainPicker({
  value,
  onChange,
  label = "选择领域",
  disabled = false,
}: {
  value: Domain[];
  onChange: (v: Domain[]) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="domain-picker" disabled={disabled}>
      <legend>
        {label} <span>可多选</span>
      </legend>
      <div>
        {domains.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={value.includes(d)}
            onClick={() =>
              onChange(
                value.includes(d)
                  ? value.filter((v) => v !== d)
                  : [...value, d],
              )
            }
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={!value.length}
        >
          清除
        </button>
      </div>
    </fieldset>
  );
}
export function Tags({ values }: { values: Domain[] }) {
  return (
    <span className="tags">
      {values.length ? (
        values.map((v) => <span key={v}>{v}</span>)
      ) : (
        <span>未分类</span>
      )}
    </span>
  );
}
export function Notice({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div className="notice" role="alert">
      <p>{error}</p>
      {onRetry && (
        <button type="button" className="button quiet" onClick={onRetry}>
          <RefreshCw size={16} />
          重试
        </button>
      )}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`os-dialog ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="关闭"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
