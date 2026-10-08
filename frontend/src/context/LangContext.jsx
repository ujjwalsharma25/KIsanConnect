import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { STR, MODES, BT, cropLabel, stateLabel } from "../i18n";

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(localStorage.getItem("kc_lang") || "hi");

  const setLang = useCallback((l) => {
    setLangState(l);
    localStorage.setItem("kc_lang", l);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = useCallback((k) => (STR[lang] && STR[lang][k]) || STR.hi[k] || k, [lang]);
  const mn = useCallback((m) => MODES[m][lang === "hi" ? 2 : 3], [lang]);
  const bt = useCallback((k) => { const b = BT.find((x) => x[0] === k); return b ? b[lang === "hi" ? 1 : 2] : ""; }, [lang]);

  const cn = useCallback((n) => cropLabel(n, lang), [lang]);
  const sn = useCallback((n) => stateLabel(n, lang), [lang]);
  return (
    <LangCtx.Provider value={{ lang, setLang, t, mn, bt, cn, sn }}>
      {children}
    </LangCtx.Provider>
  );
}

// Same name as before (useLang) so every existing component keeps working unchanged —
// only the import path changes from "../i18n" to "../context/LangContext".
export const useLang = () => useContext(LangCtx);
