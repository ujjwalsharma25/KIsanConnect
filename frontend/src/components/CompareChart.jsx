import React, { useEffect, useState } from "react";
import { F, DEFAULT_CROPS } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export default function CompareChart() {
  const { t, cn, sn } = useLang();
  const { token } = useAuth();
  const [crop, setCrop] = useState("Onion");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setRows(null); setErr("");
    api("/market/compare?commodity=" + encodeURIComponent(crop), { token })
      .then((d) => { if (alive) setRows(d.states); })
      .catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [crop, token]);

  const max = rows && rows.length ? Math.max(...rows.map((r) => r.avg_price)) : 1;

  return (
    <div className="panel">
      <h3>📊 {t("cmp")}</h3>
      <div className="sub">{t("cmps")}</div>
      <select value={crop} onChange={(e) => setCrop(e.target.value)}>
        {DEFAULT_CROPS.map((c) => <option key={c} value={c}>{cn(c)}</option>)}
      </select>
      {err && <div className="center">{err}</div>}
      {!err && !rows && <div className="center">{t("loading")}</div>}
      {rows && rows.map((r, i) => (
        <div className="ln" key={i} style={{ alignItems: "center" }}>
          <span style={{ width: 120, flexShrink: 0 }} className="m">{sn(r.state)}</span>
          <div style={{ flex: 1, background: "#1a1710", borderRadius: 6, overflow: "hidden", height: 16 }}>
            <div style={{ width: `${(r.avg_price / max) * 100}%`, height: "100%", background: "linear-gradient(90deg,var(--leaf),var(--g2))" }} />
          </div>
          <span style={{ width: 70, textAlign: "right" }}>{F(r.avg_price)}</span>
        </div>
      ))}
    </div>
  );
}
