import React, { useEffect, useRef } from "react";

// While a modal is open it owns one history entry, so the phone's Back button closes the popup
// (like an e-commerce app) instead of leaving the whole site.
export default function Modal({ onClose, children }) {
  const open = !!children;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ ...(window.history.state || {}), m: 1 }, "");
    const onPop = () => closeRef.current && closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state && window.history.state.m) window.history.back();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="mbg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mbox">{children}</div>
    </div>
  );
}
