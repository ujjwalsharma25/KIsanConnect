import React, { useState } from "react";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";

// Account security: change password, set/change the recovery PIN used by "Forgot password?".
export default function AccountModal({ onClose }) {
  const { t } = useLang();
  const { token, user } = useAuth();
  const toast = useToast();
  const [old, setOld] = useState(""), [nw, setNw] = useState("");
  const [pw, setPw] = useState(""), [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const msg = (e) => (e.code && t("e_" + e.code) !== "e_" + e.code ? t("e_" + e.code) : e.message);
  async function go(path, json, clear) {
    setBusy(true); setErr("");
    try { await api(path, { method: "POST", json, token }); toast(t("saved")); clear(); }
    catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <h3 style={{ fontFamily: "Fraunces,serif" }}>🔐 {t("acct")}</h3>
      {user && user.hasRecovery === false && <div className="err-banner">{t("noPin")}</div>}
      {err && <div className="err-banner">⚠️ {err}</div>}
      <h4 style={{ margin: "12px 0 4px" }}>{t("acctChange")}</h4>
      <label>{t("oldPass")}</label><input type="password" value={old} onChange={(e) => setOld(e.target.value)} />
      <label>{t("newPass")}</label><input type="password" value={nw} onChange={(e) => setNw(e.target.value)} />
      <button className="btn" disabled={busy} onClick={() => go("/auth/change-password", { oldPassword: old, newPassword: nw }, () => { setOld(""); setNw(""); })}>{t("save")}</button>
      <h4 style={{ margin: "18px 0 4px" }}>{t("acctPin")}</h4>
      <label>{t("pass")}</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <label>{t("rpin")}</label><input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => go("/auth/recovery", { password: pw, pin }, () => { setPw(""); setPin(""); })}>{t("save")}</button>
        <button className="btn ghost" onClick={onClose}>{t("close")}</button>
      </div>
    </>
  );
}
