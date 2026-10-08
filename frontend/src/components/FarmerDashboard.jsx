import React, { useEffect, useState, useCallback } from "react";
import { F } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, compressImage } from "../api";
import { parseVoiceListing } from "../voiceParse";
import Banner from "./Banner";
import StatCard from "./StatCard";
import HistoryPanel from "./HistoryPanel";
import MandiPrices from "./MandiPrices";
import ImpactStats from "./ImpactStats";
import CreditScore from "./CreditScore";
import { QRModal } from "./SmallModals";
import Modal from "./Modal";
import MarketAdvisor from "./MarketAdvisor";
import { Timeline, ST } from "./OrderExtras";

export default function FarmerDashboard({ tab }) {
  const { t, cn } = useLang();
  const { token, user } = useAuth();
  const toast = useToast();

  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [intel, setIntel] = useState([]);
  const [loading, setLoading] = useState(true);

  const [crop, setCrop] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [phone, setPhone] = useState(user.phone || "");
  const [loc, setLoc] = useState(user.location || "");
  const [route, setRoute] = useState("");
  const [grade, setGrade] = useState("A");
  const [organic, setOrganic] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoName, setPhotoName] = useState("");
  const [hint, setHint] = useState("");
  const [qrListing, setQrListing] = useState(null);
  const [listening, setListening] = useState(false);
  const [harvest, setHarvest] = useState(new Date().toISOString().slice(0, 10));
  const [mspHint, setMspHint] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, o, mi] = await Promise.all([
        api("/listings/mine", { token }),
        api("/orders/mine", { token }),
        api("/market/intelligence", { token }),
      ]);
      setListings(l); setOrders(o); setIntel(mi);
    } catch (e) {
      toast(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!crop.trim()) { setHint(""); return; }
    const h = setTimeout(() => {
      const m = intel.find((x) => x.name.toLowerCase().includes(crop.trim().toLowerCase()));
      setHint(m ? `📊 ${t("avgnow")}: ${F(m.avg)}/q (${m.count})` : "");
    }, 300);
    return () => clearTimeout(h);
  }, [crop, intel, t]);

  // MSP check against the official Agmarknet national report (only for crops that have an MSP)
  useEffect(() => {
    if (!crop.trim() || !(Number(rate) > 0)) { setMspHint(""); return; }
    const h = setTimeout(() => {
      api(`/market/benchmark?commodity=${encodeURIComponent(crop.trim())}&rate=${rate}`, { token })
        .then((b) => setMspHint(b.msp_check ? (b.msp_check.status === "below_msp" ? "⚠ " + t("belowMsp") : "✅ " + t("aboveMsp")) + ` (MSP ${F(b.msp_check.msp)})` : `🏛 ${t("natNow")}: ${F(b.price[0])}/q`))
        .catch(() => setMspHint(""));
    }, 500);
    return () => clearTimeout(h);
  }, [crop, rate, token, t]);

  // Voice fills the WHOLE form (crop, qty, rate, location, route, grade, organic) —
  // not just the crop name. Uses parseVoiceListing() on the full spoken sentence.
  function mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast(t("nomic"));
    const r = new SR();
    r.lang = document.documentElement.lang === "hi" ? "hi-IN" : "en-IN";
    r.continuous = false;
    r.interimResults = false;
    setListening(true);
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const parsed = parseVoiceListing(transcript);
      const filled = [];
      if (parsed.crop) { setCrop(parsed.crop); filled.push(t("crop")); }
      if (parsed.qty) { setQty(parsed.qty); filled.push(t("qty")); }
      if (parsed.rate) { setRate(parsed.rate); filled.push(t("rate")); }
      if (parsed.location) { setLoc(parsed.location); filled.push(t("loc")); }
      if (parsed.route) setRoute(parsed.route);
      if (parsed.grade) setGrade(parsed.grade);
      if (parsed.organic) setOrganic(true);
      toast(filled.length ? "🎤 " + filled.join(", ") : transcript);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.start();
  }

  async function addListing() {
    if (!crop || !qty || !rate || !phone) return toast(t("fill"));
    const fd = new FormData();
    fd.append("crop", crop); fd.append("quantityQuintal", qty); fd.append("rate", rate);
    fd.append("phone", phone); fd.append("location", loc); fd.append("route", route);
    fd.append("grade", grade); fd.append("organic", organic); fd.append("harvestDate", harvest);
    if (photo) fd.append("photo", await compressImage(photo));
    try {
      await api("/listings", { method: "POST", body: fd, token, nobkMsg: t("nobk") });
      toast(t("ok"));
      setCrop(""); setQty(""); setRate(""); setPhoto(null); setPhotoName("");
      load();
    } catch (e) { toast(e.message); }
  }

  async function act(id, action) {
    try { await api(`/orders/${id}/${action}`, { method: "PATCH", token }); toast(t("ok")); load(); }
    catch (e) { toast(e.message); }
  }
  async function closeLot(id) {
    try { await api(`/listings/${id}/close`, { method: "PATCH", token }); toast(t("ok")); load(); }
    catch (e) { toast(e.message); }
  }

  const released = orders.filter((o) => o.status === "released");
  const held = orders.filter((o) => !["released", "refunded"].includes(o.status)).reduce((s, o) => s + o.subtotal, 0);
  const ratedOrders = released.filter((o) => o.rating);
  const avgRatingNum = ratedOrders.length ? ratedOrders.reduce((s, o) => s + o.rating, 0) / ratedOrders.length : 0;
  const avgRating = ratedOrders.length ? avgRatingNum.toFixed(1) + " ★" : "—";
  const gmvTotal = released.reduce((s, o) => s + o.subtotal, 0);

  const statsBlock = (
    <div className="stats">
      <StatCard big={F(released.reduce((s, o) => s + o.subtotal, 0))} label={t("released")} />
      <StatCard big={F(held)} label={t("escrow")} />
      <StatCard big={listings.filter((l) => l.status === "active").length} label={t("lots")} />
      <StatCard big={avgRating} label={t("myrating")} />
    </div>
  );

  const addForm = (
    <div className="panel">
      <h3>{t("add")}</h3>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className={"btn" + (listening ? " gold" : " ghost")} onClick={mic}>
          {listening ? "🎙️ ..." : t("mic")}
        </button>
        <span className="m">{t("mic") === "🎤 बोलकर भरें" ? "पूरा वाक्य बोलो — जैसे: प्याज पचास क्विंटल अट्ठारह सौ रुपए मेरठ से" : "Say the whole sentence — e.g. Onion fifty quintal eighteen hundred rupees from Meerut"}</span>
      </div>
      <div className="drop" onClick={() => document.getElementById("photoInput").click()}>
        {photoName ? "✓ " + photoName : t("photo")}
      </div>
      <input id="photoInput" type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files[0]; if (f) { setPhoto(f); setPhotoName(f.name); } }} />
      <div className="two">
        <div>
          <label>{t("crop")}</label>
          <input value={crop} onChange={(e) => setCrop(e.target.value)} />
          <div className="m" style={{ color: "var(--g2)", margin: "-8px 0 10px" }}>{hint}</div>
        </div>
        <div><label>{t("qty")}</label><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><label>{t("rate")}</label><input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /><div className="m" style={{ margin: "-8px 0 10px" }}>{mspHint}</div></div>
        <div><label>{t("harvest")}</label><input type="date" max={new Date().toISOString().slice(0, 10)} value={harvest} onChange={(e) => setHarvest(e.target.value)} /></div>
        <div><label>{t("phone")}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div>
          <label>{t("grade")}</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option>A</option><option>B</option><option>C</option>
          </select>
        </div>
        <div>
          <label>&nbsp;</label>
          <label style={{ fontSize: 14, color: "var(--cream)", display: "flex", gap: 8, alignItems: "center", padding: "10px 0" }}>
            <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={organic} onChange={(e) => setOrganic(e.target.checked)} />
            {t("organic")}
          </label>
        </div>
      </div>
      <label>{t("loc")}</label><input value={loc} onChange={(e) => setLoc(e.target.value)} />
      <label>{t("route")}</label><input value={route} onChange={(e) => setRoute(e.target.value)} />
      <button className="btn" onClick={addListing}>{t("list")}</button>
    </div>
  );

  const lotsPanel = (
    <div className="panel">
      <h3>{t("mylots")}</h3>
      {!loading && listings.length === 0 && <div className="center">{t("none")}</div>}
      {listings.map((l) => (
        <div className="li" key={l._id}>
          <div>
            <b>{cn(l.crop)}</b> · {l.quantityQuintal}q · {F(l.rate)}/q
            <div className="m">{l.route}</div>
            <div className="bar" style={{ width: 200 }}><i style={{ width: `${Math.min(100, (l.booked / l.quantityQuintal) * 100)}%` }} /></div>
            <div className="m">{l.booked}/{l.quantityQuintal}q {t("booked")}</div>
          </div>
          <div className="row">
            <button className="btn gold" onClick={() => setQrListing(l)}>{t("qr")}</button>
            {l.status === "active" && <button className="btn ghost" onClick={() => closeLot(l._id)}>{t("closelot")}</button>}
          </div>
        </div>
      ))}
    </div>
  );

  const ordersPanel = (
    <>
      <div className="panel">
        <h3>{t("inord")}</h3>
        {!loading && orders.length === 0 && <div className="center">{t("none")}</div>}
        {orders.map((o) => (
          <div className="li" key={o._id}>
            <div>
              <b>{cn(o.crop)}</b> · {o.qty}q · {F(o.subtotal)}
              <div className="m">{o.buyerName} · <a style={{ color: "var(--g2)" }} href={`tel:${o.buyerPhone}`}>{o.buyerPhone}</a></div>
              <Timeline o={o} />
            </div>
            <div className="row">
              <span className="tag y">{ST(o.status, t)}</span>
              {o.status === "escrow" && <button className="btn" onClick={() => act(o._id, "ship")}>{t("ship")}</button>}
              {o.status === "disputed" && <button className="btn gold" onClick={() => act(o._id, "refund")}>{t("refund")}</button>}
            </div>
          </div>
        ))}
      </div>
      <HistoryPanel title={t("sh")} totalLabel={t("tsales")} rows={released} field="subtotal" isFarmer />
    </>
  );

  return (
    <>
      <Banner compact={tab !== "dashboard"} />
      {tab === "dashboard" && (
        <>
          {statsBlock}
          <CreditScore completedOrders={released.length} avgRating={avgRatingNum} gmv={gmvTotal} />
          <MarketAdvisor showSavings />
          {addForm}
          <ImpactStats />
        </>
      )}
      {tab === "lots" && (<>{statsBlock}{lotsPanel}</>)}
      {tab === "mandi" && <MandiPrices marketIntel={intel} isFarmer />}
      {tab === "orders" && ordersPanel}

      <Modal onClose={() => setQrListing(null)}>
        {qrListing && <QRModal listing={qrListing} onClose={() => setQrListing(null)} />}
      </Modal>
    </>
  );
}
