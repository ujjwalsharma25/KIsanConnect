import React from "react";
import { useLang } from "../context/LangContext";

// Transparent, explainable formula (not a black box) — easy to defend to judges:
//   base 300 + 10 pts per completed order (cap 25 orders) + up to 300 for avg rating (5★ = 300)
//   + up to 100 for total trading volume, capped at a 300-850 range like a real credit score.
export function computeCreditScore(completedOrders, avgRating, gmv) {
  const orderPts = Math.min(completedOrders, 25) * 10;
  const ratingPts = (avgRating || 0) * 60;
  const volumePts = Math.min(gmv / 3000, 1) * 100;
  return Math.round(Math.min(850, 300 + orderPts + ratingPts + volumePts));
}

export default function CreditScore({ completedOrders, avgRating, gmv }) {
  const { t } = useLang();
  const score = computeCreditScore(completedOrders, avgRating, gmv);
  const pct = ((score - 300) / (850 - 300)) * 100;
  const tier = score >= 650 ? t("creditHigh") : score >= 450 ? t("creditMid") : t("creditLow");

  return (
    <div className="panel credit-card fade-in">
      <div className="ring" style={{ "--pct": pct }}>
        <div className="ring-inner">
          <b>{score}</b>
          <span>/ 850</span>
        </div>
      </div>
      <div>
        <h3 style={{ marginBottom: 2 }}>{t("creditScore")}</h3>
        <div className="sub" style={{ marginBottom: 4 }}>{t("creditSub")}</div>
        <span className="tag y">{tier}</span>
      </div>
    </div>
  );
}
