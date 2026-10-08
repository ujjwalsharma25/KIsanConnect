import React, { useEffect, useState } from "react";
import { F, fmt, dayLabel } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

const CROPS = ["Onion", "Potato", "Tomato", "Wheat"];
const money = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

// Every sentence is built from codes + numbers returned by the ML service, so the card is 100% Hindi OR 100% English.
function Advisor({ crop, role }) {
  const { t, lang, cn } = useLang();
  const { token } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true; setD(null); setErr("");
    const q = encodeURIComponent(crop);
    Promise.all([api(`/market/advisor?commodity=${q}&role=${role}`, { token }), api("/market/benchmark?commodity=" + q, { token })])
      .then(([a, b]) => alive && setD({ a, b })).catch((e) => alive && setErr(e.message || "x"));
    return () => { alive = false; };
  }, [crop, role, token, retry]);
  // the free-tier ML service may be waking up: show a calm localized message and retry automatically
  useEffect(() => {
    if (!err) return;
    const h = setTimeout(() => setRetry((r) => r + 1), 8000);
    return () => clearTimeout(h);
  }, [err]);
  if (err) return <div className="center">⏳ {t("mlWaking")} <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => setRetry((r) => r + 1)}>{t("retry")}</button></div>;
  if (!d) return <div className="center">{t("loading")}</div>;
  const { a, b } = d, f = a.facts;
  const pr = [...b.price].reverse(), dates = [...b.dates].reverse();
  const lo = Math.min(...pr) * 0.92, hi = Math.max(...pr);
  const V = {
    SELL_NOW: ["n", "advSell"], WAIT: ["y", role === "buyer" ? "advWaitB" : "advWait"], BUY_NOW: ["g", "advBuy"], NEUTRAL: ["y", "advNeutral"],
  }[a.verdict];
  const sign = (n) => (n > 0 ? "+" : "") + n;
  const lines = a.codes.map((c) => {
    if (c === "price_move") return fmt(t("advPrice"), { from: money(f.price_from), to: money(f.price_to), pct: sign(f.price_pct) });
    if (c === "arrivals") return f.arr_basis === "partial"
      ? fmt(t("advArrP"), { pct: sign(Math.round(f.arr_pct)), d1: dayLabel(f.arr_dates[1] || a.dates[1], lang), d2: dayLabel(f.arr_dates[0], lang) })
      : fmt(t("advArrA"), { pct: sign(Math.round(f.arr_pct)) });
    if (c === "msp_below") return fmt(t("c_msp_below"), { msp: Math.round(f.msp) });
    return t("c_" + c);
  });
  const h = a.history;
  const histTxt = h && fmt(t("advHist"), { from: dayLabel(h.from, lang), to: dayLabel(h.to, lang), rows: h.rows.toLocaleString("en-IN"),
    chg: Object.entries(h.oct_to_nov).map(([y, v]) => `${y}: ${sign(v)}%`).join(", ") });
  return (
    <div className="adv">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className={"tag big " + V[0]}>{t(V[1])}</span>
        <span className="m">{t("advSource")}</span>
      </div>
      <div className="spark">
        {pr.map((p, i) => (
          <div key={i}><div className="sb" style={{ height: 14 + ((p - lo) / (hi - lo || 1)) * 56 }} /><b>{money(p)}</b><span className="m">{dayLabel(dates[i], lang)}</span></div>
        ))}
      </div>
      <div className="m" style={{ marginBottom: 6 }}>ℹ️ <b>{t("advExplainT")}</b> {t("advExplain")}</div>
      {b.msp && <div className="m">🏛 {t("advMspLbl")}: <b>{money(b.msp)}</b>/{t("qShort")} {b.price[0] < b.msp ? "· ⚠ " + t("belowMsp") : "· ✅ " + t("aboveMsp")}</div>}
      <ul className="why">{lines.map((r, i) => <li key={i}>{r}</li>)}</ul>
      {histTxt && <div className="m">📜 {histTxt}</div>}
      <div className="m" style={{ marginTop: 6 }}>{t("advDisc")}</div>
    </div>
  );
}

function Savings({ crop }) {
  const { t, lang } = useLang();
  const { token } = useAuth();
  const [qty, setQty] = useState(50), [rate, setRate] = useState(""), [cut, setCut] = useState(6), [tr, setTr] = useState(30);
  const [r, setR] = useState(null), [err, setErr] = useState("");
  useEffect(() => {
    setRate("");
    api("/market/benchmark?commodity=" + encodeURIComponent(crop), { token }).then((b) => setRate(Math.round(b.price[0]))).catch(() => {});
  }, [crop, token]);
  useEffect(() => {
    if (!(qty > 0) || !(rate > 0)) { setR(null); return; }
    const h = setTimeout(() => {
      api(`/market/savings?crop=${encodeURIComponent(crop)}&qty=${qty}&rate=${rate}&cut=${cut}&transport=${tr}`, { token })
        .then((x) => { setR(x); setErr(""); }).catch((e) => { setR(null); setErr(e.message); });
    }, 400);
    return () => clearTimeout(h);
  }, [crop, qty, rate, cut, tr, token]);
  return (
    <div className="adv">
      <div className="two">
        <div><label>{t("qty")}</label><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><label>{t("savDirect")} (₹/{t("qShort")})</label><input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1800" /></div>
        <div><label>{t("savCut")}: {cut}%</label><input type="range" min="0" max="15" step="0.5" value={cut} onChange={(e) => setCut(e.target.value)} /></div>
        <div><label>{t("savTransport")}: ₹{tr}/{t("qShort")}</label><input type="range" min="0" max="150" step="5" value={tr} onChange={(e) => setTr(e.target.value)} /></div>
      </div>
      {err && <div className="m">⏳ {t("mlWaking")}</div>}
      {r && (
        <>
          <div className="stats3">
            <div className="stat"><b>{F(r.mandiNet)}</b><span>{t("savMandi")} (@{F(r.mandiRate)}/{t("qShort")})</span></div>
            <div className="stat"><b>{F(r.directNet)}</b><span>KisanConnect</span></div>
            <div className="stat"><b style={{ color: r.extra >= 0 ? "var(--leaf-dk)" : "var(--danger)" }}>{r.extra >= 0 ? "+" : ""}{F(r.extra)}</b><span>{t("savExtra")}{r.extraPct != null ? ` (${r.extraPct}%)` : ""}</span></div>
          </div>
          <div className="m">{t("savAssume")} · {r.mandiSource && r.mandiSource.startsWith("Agmarknet") ? fmt(t("savSrcNat"), { d: dayLabel(r.mandiSource.split(", ").slice(1).join(", "), lang) }) : t("savSrcAi")}</div>
        </>
      )}
    </div>
  );
}

export default function MarketAdvisor({ showSavings }) {
  const { t, cn } = useLang();
  const { user } = useAuth();
  const role = user && user.role === "buyer" ? "buyer" : "farmer";
  const [crop, setCrop] = useState("Onion");
  return (
    <div className="panel">
      <h3>📈 {t(role === "buyer" ? "advTitleB" : "advTitle")} <span className="tag n">{t("newTag")}</span></h3>
      <div className="sub">{t("advSub")}</div>
      <div className="crop-chip-row">
        {CROPS.map((c) => <button key={c} className={"chip" + (crop === c ? " on" : "")} onClick={() => setCrop(c)}>{cn(c)}</button>)}
      </div>
      <Advisor crop={crop} role={role} />
      {showSavings && (
        <>
          <h3 style={{ marginTop: 18 }}>💰 {t("savTitle")}</h3>
          <div className="sub">{t("savSub")}</div>
          <Savings crop={crop} />
        </>
      )}
    </div>
  );
}
