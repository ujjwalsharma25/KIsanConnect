import React, { useEffect, useState } from "react";
import { F } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { getFairPrice, dealLabel } from "../useFairPrice";

const isNew = (l) => Date.now() - new Date(l.createdAt) < 864e5;

export default function ProductCard({ listing: l, marketIntel, onBuy, onContact }) {
  const { t, mn, cn } = useLang();
  const { token } = useAuth();
  const [deal, setDeal] = useState(null);
  const [imgBad, setImgBad] = useState(false);

  useEffect(() => {
    let alive = true;
    getFairPrice(l.crop, token).then((fp) => { if (alive) setDeal(dealLabel(l.rate, fp, t)); });
    return () => { alive = false; };
  }, [l.crop, l.rate, token, t]);

  const wa = (l.farmerPhone || "").replace(/\D/g, "");
  const waNum = wa.length === 10 ? "91" + wa : wa;
  const waMsg = encodeURIComponent(`Namaste, ${l.crop} ${l.quantityQuintal}q KisanConnect`);
  const m = marketIntel && marketIntel.find((x) => x.name.toLowerCase() === l.crop.toLowerCase() && x.count > 1);
  const dv = m ? Math.round(((l.rate - m.avg) / m.avg) * 100) : 0;
  const pct = l.quantityQuintal ? (l.booked / l.quantityQuintal) * 100 : 0;

  return (
    <div className="prod tilt">
      {l.photoUrl && !imgBad ? <img src={l.photoUrl} alt="" loading="lazy" onError={() => setImgBad(true)} /> : <div className="ph">🌾</div>}
      <div className="pb">
        <h4>{cn(l.crop)}</h4>
        <div className="pr">{F(l.rate)}<span className="m">/q</span></div>
        <div>
          {isNew(l) && <span className="tag n">{t("newb")}</span>}
          <span className="tag">{t("grade")} {l.grade || "A"}</span>
          {l.organic && <span className="tag g">🌱</span>}
          {deal && <span className={`tag ${deal.cls}`}>{deal.text}</span>}
          {dv !== 0 && <span className={`tag ${dv < 0 ? "" : "y"}`}>{dv < 0 ? "↓" : "↑"}{Math.abs(dv)}% {t("vs")}</span>}
        </div>
        <div className="m">{l.farmerName} {l.farmerRating ? `⭐ ${l.farmerRating.avg.toFixed(1)} (${l.farmerRating.count})` : ""} · {l.location}</div>
        {l.route && <span className="tag y">🗓 {l.route}</span>}
        {l.daysLeft != null && (
          <div style={{ marginTop: 6 }}>
            <span className={"tag " + (l.urgent ? "n" : "g")}>{l.urgent ? "⏳ " + t("sellSoon") + " · " + l.daysLeft + t("dayUnit") + " " + t("left") : "🌿 " + l.daysLeft + t("dayUnit") + " " + t("fresh")}</span>
            <div className="bar"><i style={{ width: `${l.freshnessPct}%`, background: l.urgent ? "var(--danger)" : undefined }} /></div>
          </div>
        )}
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="m">{l.booked}/{l.quantityQuintal}q {t("booked")} · {l.remaining}q {t("left")}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => onBuy(l)}>{t("buy")}</button>
          <button className="btn ghost" onClick={() => onContact(l.farmerName, l.farmerPhone)}>{t("contact")}</button>
          {wa && <a className="btn gold" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${waNum}?text=${waMsg}`}>WhatsApp</a>}
        </div>
      </div>
    </div>
  );
}
