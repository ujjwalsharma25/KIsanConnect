import React, { useState } from "react";
import { useLang } from "../context/LangContext";
import { F, DEFAULT_CROPS } from "../i18n";
import CompareChart from "./CompareChart";
import Modal from "./Modal";
import FairPriceModal from "./FairPriceModal";
import MarketAdvisor from "./MarketAdvisor";

export default function MandiPrices({ marketIntel, isFarmer }) {
  const { t, cn } = useLang();
  const [fairCrop, setFairCrop] = useState(null);

  return (
    <>
    <MarketAdvisor showSavings={isFarmer} />
    <div className="page-grid">
      <div className="panel">
        <h3>✨ {t("mi")} <span className="tag y">{t("premium")}</span></h3>
        <div className="sub">{t("mis")}</div>
        {(!marketIntel || marketIntel.length === 0) && <div className="center">{t("none")}</div>}
        <div className="crop-chip-row">
          {DEFAULT_CROPS.map((c) => (
            <button key={c} className="crop-chip" onClick={() => setFairCrop(c)}>🤖 {cn(c)}</button>
          ))}
        </div>
        {marketIntel && marketIntel.length > 0 && marketIntel.slice(0, 8).map((x) => (
          <div className="ln" key={x.name} style={{ cursor: "pointer" }} onClick={() => setFairCrop(x.name)}>
            <span>📈 {cn(x.name)} <span className="m">({x.count})</span></span>
            <span>{F(x.avg)} · {F(x.min)}–{F(x.max)}</span>
          </div>
        ))}
      </div>

      <CompareChart />

      <Modal onClose={() => setFairCrop(null)}>
        {fairCrop && <FairPriceModal crop={fairCrop} onClose={() => setFairCrop(null)} />}
      </Modal>
    </div>
    </>
  );
}
