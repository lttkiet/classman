"use client";

import { useEffect, useRef } from "react";

export function Modal({ children, labelledBy, onClose }: { children: React.ReactNode; labelledBy: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={ref} className="modal accessible-modal" aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}
