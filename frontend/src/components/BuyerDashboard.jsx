import React, { useEffect, useState, useCallback, useMemo } from "react";
import { F } from "../i18n";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import Banner from "./Banner";
import StatCard from "./StatCard";
import HistoryPanel from "./HistoryPanel";
import ProductCard from "./ProductCard";
import Sidebar from "./Sidebar";
import MandiPrices from "./MandiPrices";
import ImpactStats from "./ImpactStats";
import Modal from "./Modal";
import { Timeline, DisputeModal, ST } from "./OrderExtras";
import BuyModal from "./BuyModal";
import { InvoiceModal, ContactModal, RateModal } from "./SmallModals";

export default function BuyerDashboard({ tab }) {
  const { t, bt, cn } = useLang();
  const { token, user } = useAuth();
  const toast = useToast();

  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [intel, setIntel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cropFilter, setCropFilter] = useState("");
  const [sort, setSort] = useState("new");

  const [buyTarget, setBuyTarget] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [contact, setContact] = useState(null);
  const [rateOrderId, setRateOrderId] = useState(null);
  const [disputeId, setDisputeId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, o, mi] = await Promise.all([
        api("/listings", { token }),
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
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const lotId = params.get("lot");
    if (lotId) {
      const l = listings.find((x) => x._id === lotId);
      if (l) setBuyTarget(l);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loading, listings]);

  async function act(id, action) {
    try { await api(`/orders/${id}/${action}`, { method: "PATCH", token }); toast(t("ok")); load(); }
    catch (e) { toast(e.message); }
  }

  const released = orders.filter((o) => o.status === "released");
  const held = orders.filter((o) => !["released", "refunded"].includes(o.status)).reduce((s, o) => s + o.total, 0);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    let rows = listings.filter((l) =>
      (!ql || (l.crop + " " + l.location).toLowerCase().includes(ql)) &&
      (!cropFilter || l.crop.toLowerCase() === cropFilter.toLowerCase())
    );
    if (sort === "price_low") rows = [...rows].sort((a, b) => a.rate - b.rate);
    else if (sort === "price_high") rows = [...rows].sort((a, b) => b.rate - a.rate);
    else if (sort === "expiring") rows = [...rows].sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
    else rows = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return rows;
  }, [listings, q, cropFilter, sort]);

  const statsBlock = (
    <div className="stats">
      <StatCard big={F(released.reduce((s, o) => s + o.total, 0))} label={t("spent")} />
      <StatCard big={F(held)} label={t("escrow")} />
      <StatCard big={orders.length} label={t("orders")} />
    </div>
  );

  const ordersPanel = (
    <>
      <div className="panel">
        <h3>{t("myord")}</h3>
        {!loading && orders.length === 0 && <div className="center">{t("none")}</div>}
        {orders.map((o) => (
          <div className="li" key={o._id}>
            <div>
              <b>{cn(o.crop)}</b> · {o.qty}q · {F(o.total)}
              <div className="m">{o.farmerName}</div>
              <Timeline o={o} />
            </div>
            <div className="row">
              <span className="tag y">{ST(o.status, t)}</span>
              {["escrow", "shipped"].includes(o.status) && <button className="btn" onClick={() => act(o._id, "release")}>{t("rel")}</button>}
              {["escrow", "shipped"].includes(o.status) && <button className="btn ghost" onClick={() => setDisputeId(o._id)}>⚠ {t("dispute")}</button>}
              {o.status === "disputed" && <button className="btn ghost" onClick={() => act(o._id, "withdraw")}>{t("withdraw")}</button>}
              {o.status === "released" && (o.rating ? <span className="tag">⭐{o.rating}</span> : <button className="btn gold" onClick={() => setRateOrderId(o._id)}>{t("rateb")}</button>)}
              <button className="btn ghost" onClick={() => setContact({ name: o.farmerName, phone: o.farmerPhone })}>{t("contact")}</button>
              <button className="btn ghost" onClick={() => setInvoiceOrder(o)}>{t("inv")}</button>
            </div>
          </div>
        ))}
      </div>
      <HistoryPanel title={t("phs")} totalLabel={t("tbought")} rows={released} field="total" />
    </>
  );

  return (
    <>
      <Banner compact={tab !== "dashboard"} />

      {tab === "dashboard" && (<>{statsBlock}<ImpactStats /><MandiPrices marketIntel={intel} /></>)}

      {tab === "marketplace" && (
        <div className="shop-layout">
          <Sidebar q={q} setQ={setQ} cropFilter={cropFilter} setCropFilter={setCropFilter} sort={sort} setSort={setSort} />
          <div className="panel">
            <h3>{t("mk")}</h3>
            <div className="sub">{t("mks")}</div>
            <div className="grid">
              {!loading && filtered.length === 0 && <div className="center">{t("none")}</div>}
              {filtered.map((l) => (
                <ProductCard key={l._id} listing={l} marketIntel={intel}
                  onBuy={setBuyTarget}
                  onContact={(name, phone) => setContact({ name, phone })} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "mandi" && <MandiPrices marketIntel={intel} />}

      {tab === "orders" && ordersPanel}

      <Modal onClose={() => setBuyTarget(null)}>
        {buyTarget && (
          <BuyModal listing={buyTarget} onClose={() => setBuyTarget(null)}
            onDone={(order) => { setBuyTarget(null); load(); setInvoiceOrder(order); }} />
        )}
      </Modal>
      <Modal onClose={() => setInvoiceOrder(null)}>
        {invoiceOrder && <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />}
      </Modal>
      <Modal onClose={() => setContact(null)}>
        {contact && <ContactModal name={contact.name} phone={contact.phone} onClose={() => setContact(null)} />}
      </Modal>
      <Modal onClose={() => setDisputeId(null)}>
        {disputeId && <DisputeModal orderId={disputeId} onClose={() => setDisputeId(null)} onDone={() => { setDisputeId(null); load(); }} />}
      </Modal>
      <Modal onClose={() => setRateOrderId(null)}>
        {rateOrderId && <RateModal orderId={rateOrderId} onClose={() => setRateOrderId(null)}
          onRated={() => { setRateOrderId(null); load(); }} />}
      </Modal>
    </>
  );
}
