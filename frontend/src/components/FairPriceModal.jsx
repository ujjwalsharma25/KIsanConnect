import React, { useEffect, useState } from "react";
import { F, dayLabel } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

function WhyPrice({ crop }) {
  const { t, cn, sn, lang } = useLang();
  const { token } = useAuth();
  const [states, setStates] = useState([]);
  const [state, setState] = useState("");
  const [variety, setVariety] = useState("");
  const [d, setD] = useState(null);
  useEffect(() => { api("/market/states?commodity=" + encodeURIComponent(crop), { token }).then((x) => setStates(x.states)).catch(() => {}); }, [crop, token]);
  useEffect(() => {
    if (!state && !variety) { setD(null); return; }
    api(`/market/explain?commodity=${encodeURIComponent(crop)}&state=${encodeURIComponent(state)}&variety=${encodeURIComponent(variety)}`, { token }).then(setD).catch(() => setD(null));
  }, [crop, state, variety, token]);
  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ fontFamily: "Fraunces,serif", fontSize: 15, marginBottom: 6 }}>🔍 {t("whyTitle")}</h4>
      <div className="two">
        <select value={state} onChange={(e) => setState(e.target.value)}><option value="">{t("whyState")}</option>{states.map((s) => <option key={s} value={s}>{sn(s)}</option>)}</select>
        <input placeholder={t("whyVariety")} value={variety} onChange={(e) => setVariety(e.target.value)} />
      </div>
      {d && (
        <>
          <div className="ln"><span>{t("whyBase")}</span><b>{F(d.crop_base_price)}</b></div>
          {d.factors.map((f) => (
            <div className="ln" key={f.factor}>
              <span>{t({ state: "fState", variety: "fVariety", market: "fMarket" }[f.factor] || "fState")}: {f.factor === "state" ? sn(f.value) : f.value}</span>
              <span style={{ color: f.impact_pct >= 0 ? "var(--leaf-dk)" : "var(--danger)", fontWeight: 800 }}>{f.impact_pct >= 0 ? "+" : ""}{f.impact_pct}%</span>
            </div>
          ))}
          <div className="ln"><span>{t("whyEst")}</span><b>{F(d.estimate)}</b></div>
          <div className="m">{t("whyNote")}</div>
        </>
      )}
    </div>
  );
}

export default function FairPriceModal({ crop, onClose }) {
  const { t, cn, sn, lang } = useLang();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null); setErr("");
    Promise.all([
      api("/market/fair-price?commodity=" + encodeURIComponent(crop), { token }),
      api("/market/top-markets?commodity=" + encodeURIComponent(crop), { token }),
    ]).then(([fp, tm]) => { if (alive) setData({ fp, tm }); })
      .catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [crop, token]);

  if (err) {
    return (
      <>
        <div className="center">{err}</div>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={onClose}>{t("close")}</button>
      </>
    );
  }
  if (!data) return <div className="center">{t("loading")}</div>;

  const { fp, tm } = data;
  return (
    <>
      <h3 style={{ fontFamily: "Fraunces,serif" }}>🤖 {cn(fp.commodity)} — {t("fpTitle")}</h3>
      <p className="sub">{t("fpDesc")}</p>
      <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="stat"><b>{F(fp.fair_price)}</b><span>{t("fpFair")}/q</span></div>
        <div className="stat"><b>{F(fp.low)}–{F(fp.high)}</b><span>{t("fpRange")}</span></div>
      </div>
      {fp.national_today && <p className="m" style={{ marginTop: 8 }}>🏛 {t("natNow")} ({dayLabel(fp.national_today.date, lang)}): <b>{F(fp.national_today.price)}</b>/q — Agmarknet. {t("fpSnapNote")}</p>}
      <p className="m" style={{ margin: "8px 0 14px" }}>{fp.based_on_markets} {t("fpBased")} · {fp.data_date.join(", ")}</p>
      <h4 style={{ fontFamily: "Fraunces,serif", fontSize: 15, marginBottom: 6 }}>{t("cheapest")}</h4>
      {tm.cheapest.map((m, i) => (
        <div className="ln" key={i}><span>{m.market}, {sn(m.state)}</span><span>{F(m.modal)}</span></div>
      ))}
      <h4 style={{ fontFamily: "Fraunces,serif", fontSize: 15, margin: "12px 0 6px" }}>{t("costliest")}</h4>
      {tm.costliest.map((m, i) => (
        <div className="ln" key={i}><span>{m.market}, {sn(m.state)}</span><span>{F(m.modal)}</span></div>
      ))}
      <WhyPrice crop={crop} />
      <button className="btn ghost" style={{ marginTop: 14 }} onClick={onClose}>{t("close")}</button>
    </>
  );
}
