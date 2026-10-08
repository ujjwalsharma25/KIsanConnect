import React from "react";
import { useLang } from "../context/LangContext";
import { DEFAULT_CROPS } from "../i18n";

export default function Sidebar({ q, setQ, cropFilter, setCropFilter, sort, setSort }) {
  const { t, cn } = useLang();
  return (
    <aside className="sidebar">
      <div className="panel">
        <h3 style={{ fontSize: 15 }}>{t("search")}</h3>
        <input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />

        <div className="sb-label">{t("crop")}</div>
        <div className="sb-chips">
          <button className={"chip" + (cropFilter === "" ? " on" : "")} onClick={() => setCropFilter("")}>{t("all")}</button>
          {DEFAULT_CROPS.map((c) => (
            <button key={c} className={"chip" + (cropFilter === c ? " on" : "")} onClick={() => setCropFilter(cropFilter === c ? "" : c)}>{cn(c)}</button>
          ))}
        </div>

        <div className="sb-label">{t("sort")}</div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">{t("sortNew")}</option>
          <option value="price_low">{t("sortLow")}</option>
          <option value="price_high">{t("sortHigh")}</option>
          <option value="expiring">{t("sortExp")}</option>
        </select>
      </div>
    </aside>
  );
}
