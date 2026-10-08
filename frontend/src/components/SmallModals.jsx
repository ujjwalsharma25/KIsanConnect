import React, { useState } from "react";
import { F, MODES } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";

export function InvoiceModal({ order: o, onClose }) {
  const { t, mn, cn } = useLang();
  return (
    <>
      <h3 style={{ fontFamily: "Fraunces,serif" }}>🧾 {t("inv")} #{String(o._id).slice(-6).toUpperCase()}</h3>
      <p className="sub">{new Date(o.createdAt).toLocaleString()} · {o.farmerName} → {o.buyerName}</p>
      <div className="ln"><span>{cn(o.crop)} × {o.qty}q @ {F(o.rate)}</span><span>{F(o.subtotal)}</span></div>
      <div className="ln"><span>{t("fee")}</span><span>{F(o.fee)}</span></div>
      <div className="ln"><span>{mn(o.mode)}</span><span>{F(o.deliveryFee)}</span></div>
      <div className="ln t"><span>{t("total")}</span><span>{F(o.total)}</span></div>
      <p className="m" style={{ margin: "10px 0" }}>🔒 {{ escrow: t("sE"), shipped: t("sS"), released: t("sR") }[o.status]} · {o.farmerName}: {o.farmerPhone}</p>
      <button className="btn ghost" onClick={onClose}>{t("close")}</button>
    </>
  );
}

export function ContactModal({ name, phone, onClose }) {
  const { t, cn } = useLang();
  return (
    <>
      <h3 style={{ fontFamily: "Fraunces,serif" }}>{name}</h3>
      <p style={{ fontSize: 22, margin: "10px 0", color: "var(--g2)", fontWeight: 800 }}>{phone}</p>
      <div className="row">
        <a className="btn" href={`tel:${phone}`}>{t("call")}</a>
        <button className="btn ghost" onClick={onClose}>{t("close")}</button>
      </div>
    </>
  );
}

export function RateModal({ orderId, onClose, onRated }) {
  const { t, cn } = useLang();
  const { token } = useAuth();
  const toast = useToast();
  const [star, setStar] = useState(0);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!star) return toast(t("pickstar"));
    setBusy(true);
    try {
      await api(`/orders/${orderId}/rate`, { method: "PATCH", json: { rating: star, review }, token });
      toast(t("ok"));
      onRated();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h3 style={{ fontFamily: "Fraunces,serif" }}>{t("rateq")}</h3>
      <div style={{ margin: "12px 0" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`star ${i <= star ? "on" : ""}`} onClick={() => setStar(i)}>★</span>
        ))}
      </div>
      <input placeholder={t("review")} value={review} onChange={(e) => setReview(e.target.value)} />
      <div className="row">
        <button className="btn" disabled={busy} onClick={send}>{t("submit")}</button>
        <button className="btn ghost" onClick={onClose}>{t("close")}</button>
      </div>
    </>
  );
}

export function QRModal({ listing, onClose }) {
  const { t, cn } = useLang();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  React.useEffect(() => {
    api(`/listings/${listing._id}/qr`, { token }).then(setData).catch(() => {});
  }, [listing._id, token]);

  function printQr() {
    if (!data) return;
    const w = window.open("");
    w.document.write(`<body style="font-family:sans-serif;text-align:center"><h1>${listing.crop}</h1><h2>₹${listing.rate}/quintal</h2><img src="${data.dataUrl}" width="320"><p>KisanConnect</p></body>`);
    w.document.close(); w.print();
  }

  return (
    <>
      <h3 style={{ fontFamily: "Fraunces,serif" }}>{t("qr")}</h3>
      <p className="sub">{t("qrs")}</p>
      <div style={{ textAlign: "center" }}>
        {data ? <img src={data.dataUrl} style={{ width: 240, background: "#fff", padding: 8, borderRadius: 12 }} /> : <div className="spin" />}
        <div style={{ fontWeight: 800, marginTop: 8 }}>{cn(listing.crop)} · {F(listing.rate)}/q</div>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn gold" disabled={!data} onClick={printQr}>{t("print")}</button>
        <button className="btn ghost" onClick={onClose}>{t("close")}</button>
      </div>
    </>
  );
}
