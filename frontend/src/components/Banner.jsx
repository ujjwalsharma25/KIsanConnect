import React from "react";
import { useLang } from "../context/LangContext";

export default function Banner({ compact }) {
  const { t } = useLang();
  return (
    <div className={"banner" + (compact ? " compact" : "")}>
      <div className="banner-icon">🌾</div>
      <div>
        <h1>{t("ht")}</h1>
        {!compact && <p>{t("hs")}</p>}
        {!compact && (
          <div className="banner-chips">
            <span>{t("bnEscrow")}</span><span>{t("bnAi")}</span><span>{t("bnMsp")}</span><span>{t("bnSell")}</span><span>{t("bnVoice")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
