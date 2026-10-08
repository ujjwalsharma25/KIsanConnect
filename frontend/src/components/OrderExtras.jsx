import React, { useEffect, useState } from "react";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";

export const ST = (s, t) => ({ escrow: t("sE"), shipped: t("sS"), released: t("sR"), disputed: t("sD"), refunded: t("sF") }[s] || s);

// Order timeline (escrow -> shipped -> released / disputed -> refunded). Falls back to timestamps for older orders.
export function Timeline({ o }) {
  const { t } = useLang();
  const ev = o.events && o.events.length ? o.events : [
    { status: "escrow", at: o.createdAt },
    ...(o.shippedAt ? [{ status: "shipped", at: o.shippedAt }] : []),
    ...(o.releasedAt ? [{ status: "released", at: o.releasedAt }] : []),
  ];
  return (
    <div className="tl">
      {ev.map((e, i) => (
        <div className="tl-i" key={i} title={e.note || ""}>
          <i className={"tl-dot " + e.status} />
          <b>{ST(e.status, t)}</b>
          <span className="m">{new Date(e.at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      ))}
      {o.status === "disputed" && o.disputeReason && <div className="m" style={{ color: "var(--danger)" }}>⚠ {o.disputeReason}</div>}
      {o.autoReleased && <div className="m">⏱ {t("autoDone")}</div>}
      {o.status === "shipped" && o.autoReleaseAt && <AutoRelease at={o.autoReleaseAt} />}
    </div>
  );
}

function AutoRelease({ at }) {
  const { t } = useLang();
  const [, tick] = useState(0);
  useEffect(() => { const h = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(h); }, []);
  const mins = Math.max(0, Math.round((new Date(at) - Date.now()) / 60000));
  const txt = mins >= 120 ? `${Math.round(mins / 60)}h` : `${mins}m`;
  return <div className="m">⏱ {t("autoRel")}: <b>{txt}</b></div>;
}

export function DisputeModal({ orderId, onClose, onDone }) {
  const { t } = useLang();
  const { token } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try { await api(`/orders/${orderId}/dispute`, { method: "PATCH", json: { reason }, token }); toast(t("ok")); onDone(); }
    catch (e) { toast(e.message); setBusy(false); }
  }
  return (
    <>
      <h3 style={{ fontFamily: "Fraunces,serif" }}>⚠ {t("disputeTitle")}</h3>
      <p className="sub">{t("disputeSub")}</p>
      <textarea className="ta" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("disputeWhy")} />
      <div className="row">
        <button className="btn" disabled={busy} onClick={send}>{t("submit")}</button>
        <button className="btn ghost" onClick={onClose}>{t("close")}</button>
      </div>
    </>
  );
}
