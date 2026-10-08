import React from "react";
import { F } from "../i18n";
import { useLang } from "../context/LangContext";

export default function HistoryPanel({ title, totalLabel, rows, field, isFarmer }) {
  const { t, cn } = useLang();
  const total = rows.reduce((s, o) => s + o[field], 0);
  return (
    <div className="panel">
      <h3>{title}</h3>
      <div className="sub">{totalLabel}: <b style={{ color: "var(--g2)" }}>{F(total)}</b></div>
      {rows.length === 0 && <div className="center">{t("none")}</div>}
      {rows.map((o) => (
        <div className="li" key={o._id}>
          <div>
            <b>{cn(o.crop)}</b> · {o.qty}q
            <div className="m">
              {new Date(o.releasedAt || o.createdAt).toLocaleDateString()} · {isFarmer ? o.buyerName : o.farmerName}
              {o.rating ? " · ⭐" + o.rating : ""}
            </div>
          </div>
          <b>{F(o[field])}</b>
        </div>
      ))}
    </div>
  );
}
