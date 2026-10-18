import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowUpRight, Dumbbell } from "lucide-react";
export const number = (value: number, decimals = 0) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: decimals }).format(
    value,
  );
export const date = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Dumbbell size={22} />
      </span>
      pipsfit<span className="brand-dot">.</span>
    </span>
  );
}
export function Modal({
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
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Fechar">
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Dumbbell size={28} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function LinkButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={17} />
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(
    new Blob([type.startsWith("text/csv") ? "\ufeff" : "", text], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
