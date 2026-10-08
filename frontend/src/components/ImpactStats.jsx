import React, { useEffect, useState } from "react";
import { useLang } from "../context/LangContext";
import { F } from "../i18n";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export default function ImpactStats() {
  const { t } = useLang();
  const { token } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    api("/stats/impact", { token }).then((d) => { if (alive) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, [token]);

  if (!data) return null;

  return (
    <div className="panel fade-in">
      <h3>🌍 {t("impact")}</h3>
      <div className="sub">{t("impactSub")}</div>
      <div className="stats">
        <div className="stat"><b>{data.farmers}</b><span>{t("totalFarmers")}</span></div>
        <div className="stat"><b>{data.buyers}</b><span>{t("totalBuyers")}</span></div>
        <div className="stat"><b>{data.listings}</b><span>{t("totalListings")}</span></div>
        <div className="stat"><b>{F(data.gmv)}</b><span>{t("totalGmv")}</span></div>
      </div>
    </div>
  );
}
