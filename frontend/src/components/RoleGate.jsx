import React, { useState } from "react";
import Banner from "./Banner";
import { BT } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";

export default function RoleGate() {
  const [stage, setStage] = useState("role"); // 'role' | 'auth'
  const [selRole, setSelRole] = useState("farmer");

  if (stage === "role") {
    return (
      <>
        <Banner />
        <RolePicker onPick={(r) => { setSelRole(r); setStage("auth"); }} />
      </>
    );
  }
  return (
    <>
      <Banner />
      <AuthForm role={selRole} onChangeRole={() => setStage("role")} />
    </>
  );
}

function RolePicker({ onPick }) {
  const { t } = useLang();
  return (
    <>
      <h2 style={{ fontFamily: "Fraunces,serif", textAlign: "center", marginBottom: 16 }}>{t("pick")}</h2>
      <div className="roles">
        <div className="role tilt" onClick={() => onPick("farmer")}><big>🌾</big>{t("rf_")}</div>
        <div className="role tilt" onClick={() => onPick("buyer")}><big>🛒</big>{t("rb_")}</div>
      </div>
    </>
  );
}

function AuthForm({ role, onChangeRole }) {
  const { t, lang } = useLang();
  const { login } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  const [buyerType, setBuyerType] = useState(BT[0][0]);
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [pin, setPin] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const su = mode === "signup";
  const fg = mode === "forgot";
  const msg = (e) => (e.code && t("e_" + e.code) !== "e_" + e.code ? t("e_" + e.code) : e.message);

  async function reset() {
    setErr("");
    if (!phone.trim() || !pin || !pw) { setErr(t("fill")); return; }
    if (pw !== pw2) { setErr(t("mismatch")); return; }
    setBusy(true);
    try {
      await api("/auth/forgot", { method: "POST", json: { phone, pin, newPassword: pw }, nobkMsg: t("nobk") });
      toast(t("resetOk")); setPw(""); setPw2(""); setPin(""); setMode("login");
    } catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  }

  async function submit() {
    setErr("");
    if (fg) return reset();
    if (!phone.trim() || !pw) { setErr(t("fill")); return; }
    if (su && !/^\d{4,6}$/.test(pin)) { setErr(t("e_BAD_PIN_FORMAT")); return; }
    setBusy(true);
    try {
      let d;
      if (su) {
        if (!name.trim()) { setBusy(false); setErr(t("fill")); return; }
        d = await api("/auth/signup", { method: "POST", json: { name, phone, password: pw, recoveryPin: pin, role, location: loc, buyerType: role === "buyer" ? buyerType : "" }, nobkMsg: t("nobk") });
      } else {
        d = await api("/auth/login", { method: "POST", json: { phone, password: pw }, nobkMsg: t("nobk") });
        if (d.user.role !== role) {
          setBusy(false);
          setErr(t("wrong") + " " + (d.user.role === "farmer" ? t("rf_") : t("rb_")));
          return;
        }
      }
      login(d.token, d.user);
    } catch (e) {
      setErr(msg(e));
      toast(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 440, margin: "auto" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <span className="tag y" style={{ fontSize: 14 }}>{role === "farmer" ? "🌾 " + t("rf_") : "🛒 " + t("rb_")}</span>
        <a href="#" style={{ color: "var(--g2)", fontSize: 13 }} onClick={(e) => { e.preventDefault(); onChangeRole(); }}>{t("chg")}</a>
      </div>
      {err && <div className="err-banner">⚠️ {err}</div>}
      {su && (
        <>
          <label>{t("name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label>{t("loc")}</label>
          <input value={loc} onChange={(e) => setLoc(e.target.value)} />
          {role === "buyer" && (
            <>
              <label>{t("btype")}</label>
              <select value={buyerType} onChange={(e) => setBuyerType(e.target.value)}>
                {BT.map((b) => <option key={b[0]} value={b[0]}>{b[lang === "hi" ? 1 : 2]}</option>)}
              </select>
            </>
          )}
        </>
      )}
      {fg && (<><h3 style={{ fontFamily: "Fraunces,serif", margin: "4px 0" }}>🔑 {t("forgotTitle")}</h3><div className="sub">{t("forgotSub")}</div></>)}
      <label>{t("phone")}</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" />
      {(fg || su) && (
        <>
          <label>{t("rpin")}</label>
          <input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
          {su && <div className="m" style={{ margin: "-8px 0 10px" }}>{t("rpinHint")}</div>}
        </>
      )}
      <label>{fg ? t("newPass") : t("pass")}</label>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {fg && (<><label>{t("confPass")}</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></>)}
      <button className="btn" style={{ width: "100%" }} disabled={busy} onClick={submit}>
        {fg ? t("resetBtn") : su ? t("signup") : t("login")}
      </button>
      {!su && !fg && (
        <p className="center" style={{ margin: "10px 0 0" }}>
          <a href="#" style={{ color: "var(--g2)" }} onClick={(e) => { e.preventDefault(); setErr(""); setMode("forgot"); }}>{t("forgot")}</a>
        </p>
      )}
      <p className="center">
        {fg
          ? <a href="#" style={{ color: "var(--g2)" }} onClick={(e) => { e.preventDefault(); setErr(""); setMode("login"); }}>{t("backLogin")}</a>
          : <a href="#" style={{ color: "var(--g2)" }} onClick={(e) => { e.preventDefault(); setErr(""); setMode(su ? "login" : "signup"); }}>{su ? t("haveacc") : t("noacc")}</a>}
      </p>
    </div>
  );
}
