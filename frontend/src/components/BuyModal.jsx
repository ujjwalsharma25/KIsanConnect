import React, { useState } from "react";
import { F, MODES } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";

export default function BuyModal({ listing, onClose, onDone }) {
  const { t, mn, cn } = useLang();
  const { token } = useAuth();
  const toast = useToast();
  const [qty, setQty] = useState(Math.min(5, listing.remaining));
  const [mode, setMode] = useState("pickup");
  const [busy, setBusy] = useState(false);

  const qy = Math.max(0, Math.min(listing.remaining, +qty || 0));
  const sub = qy * listing.rate;
  const fee = Math.round(sub * 0.02);
  const del = qy * MODES[mode][0];
  const tot = sub + fee + del;

  async function pay() {
    if (qy < 1) return toast(t("fill"));
    setBusy(true);
    try {
      const o = await api("/orders", { method: "POST", json: { listingId: listing._id, qty: qy, mode }, token, nobkMsg: t("nobk") });
      toast(t("ok"));
      onDone(o);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h3 style={{ fontFamily: "Fraunces,serif" }}>{cn(listing.crop)} · {F(listing.rate)}/q</h3>
      <p className="sub">{t("esc")}</p>
      <label>{t("qty")} (max {listing.remaining})</label>
      <input type="number" min="1" max={listing.remaining} value={qty} onChange={(e) => setQty(e.target.value)} />
      <label>{t("dm")}</label>
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        {Object.keys(MODES).map((k) => (
          <option key={k} value={k}>{MODES[k][1]} {mn(k)} (+₹{MODES[k][0]}/q)</option>
        ))}
      </select>
      <div className="ln"><span>{t("sub")}</span><span>{F(sub)}</span></div>
      <div className="ln"><span>{t("fee")}</span><span>{F(fee)}</span></div>
      <div className="ln"><span>{t("dfee")}</span><span>{F(del)}</span></div>
      <div className="ln t"><span>{t("total")}</span><span>{F(tot)}</span></div>
      <p className="m" style={{ margin: "8px 0" }}>{t("tp")}</p>
      <button className="btn" style={{ width: "100%" }} disabled={busy} onClick={pay}>{t("pay")}</button>
    </>
  );
}
