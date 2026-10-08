import React, { useEffect, useRef, useState } from "react";
import AccountModal from "./AccountModal";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import Modal from "./Modal";

export default function TopNav({ tabs, activeTab, onTab }) {
  const { lang, setLang, t } = useLang();
  const { token, user, logout } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", close); document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, []);

  return (
    <header className="topnav">
      <div className="topnav-row wrap">
        <div className="brand">
          <span className="logo-mark">🌾</span>
          <div className="logo">Kisan<span>Connect</span></div>
        </div>
        <div className="row nav-right">
          <div className="lang-toggle desk" role="group" aria-label="language">
            <button className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")}>हिं</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          {user && (
            <div className="menu-wrap" ref={ref}>
              <button className="user-pill" onClick={() => setMenu((m) => !m)} aria-label={t("menu")}>
                <span className="avatar">{(user.name || "?").trim().charAt(0).toUpperCase()}</span>
                <span className="who"><b>{user.name}</b><i>{user.role === "farmer" ? "🌾 " + t("rf_") : "🛒 " + t("rb_")}</i></span>
                <span className="caret">▾</span>
              </button>
              {menu && (
                <div className="menu">
                  <div className="menu-h"><b>{user.name}</b><span>{user.role === "farmer" ? "🌾 " + t("rf_") : "🛒 " + t("rb_")}</span></div>
                  <div className="menu-l">{t("langL")}</div>
                  <div className="lang-toggle wide">
                    <button className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")}>हिंदी</button>
                    <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>English</button>
                  </div>
                  <button className="menu-item" onClick={() => { setMenu(false); setAcctOpen(true); }}>🔐 {t("acct")}</button>
                  <button className="menu-out" onClick={() => { setMenu(false); setConfirmOpen(true); }}>⎋ {t("logout")}</button>
                </div>
              )}
            </div>
          )}
          {token && (
            <button className="icon-btn desk" onClick={() => setConfirmOpen(true)} title={t("logout")}>⎋</button>
          )}
        </div>
      </div>
      {token && tabs && (
        <nav className="topnav-tabs wrap">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              className={"nav-tab" + (activeTab === tb.key ? " active" : "")}
              onClick={() => onTab(tb.key)}
            >
              <span className="nav-tab-icon">{tb.icon}</span>{tb.label}
            </button>
          ))}
        </nav>
      )}
      <Modal onClose={() => setAcctOpen(false)}>
        {acctOpen && <AccountModal onClose={() => setAcctOpen(false)} />}
      </Modal>
      <Modal onClose={() => setConfirmOpen(false)}>
        {confirmOpen && (
          <>
            <h3 style={{ fontFamily: "Fraunces,serif" }}>{t("logoutQ")}</h3>
            <p className="sub">{t("logoutSub")}</p>
            <div className="row">
              <button className="danger-btn btn" onClick={() => { logout(); setConfirmOpen(false); }}>{t("logoutYes")}</button>
              <button className="btn ghost" onClick={() => setConfirmOpen(false)}>{t("close")}</button>
            </div>
          </>
        )}
      </Modal>
    </header>
  );
}
