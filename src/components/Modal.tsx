"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Finestra modale su `<dialog>` nativo: Esc e clic sullo sfondo chiamano onClose. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius)] bg-transparent p-0 backdrop:bg-black/40"
    >
      <div className="card space-y-4">
        <h2 id="modal-title" className="text-lg font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
