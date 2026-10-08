import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { LangProvider } from "./context/LangContext";
import { useLang } from "./context/LangContext";
import TopNav from "./components/TopNav";
import RoleGate from "./components/RoleGate";
import FarmerDashboard from "./components/FarmerDashboard";
import BuyerDashboard from "./components/BuyerDashboard";

function useTilt() {
  useEffect(() => {
    function onMove(e) {
      const c = e.target.closest(".tilt");
      if (!c) return;
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(8px)`;
    }
    function onOut(e) {
      const c = e.target.closest && e.target.closest(".tilt");
      if (c) c.style.transform = "";
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);
}

const FARMER_TABS = ["dashboard", "lots", "mandi", "orders"];
const BUYER_TABS = ["dashboard", "marketplace", "mandi", "orders"];

function Main() {
  const { token, user } = useAuth();
  const { t } = useLang();
  const [tab, setTabState] = useState("dashboard");
  useTilt();

  // Browser/phone Back moves between tabs (dashboard -> mandi -> orders ...) instead of closing the site.
  const setTab = (k) => {
    if (k === tab) return;
    window.history.pushState({ tab: k }, "", "#" + k);
    setTabState(k);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    window.history.replaceState({ tab: "dashboard" }, "", "#dashboard");
    const onPop = (e) => {
      if (e.state && e.state.m) return;               // a modal's own entry
      setTabState((e.state && e.state.tab) || "dashboard");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => { setTabState("dashboard"); }, [user && user.role]);
  useEffect(() => { fetch("/api/market/warm").catch(() => {}); }, []);   // wake the free-tier ML service early

  if (!token || !user) {
    return (
      <>
        <TopNav tabs={null} />
        <div className="wrap"><RoleGate /></div>
      </>
    );
  }

  const isFarmer = user.role === "farmer";
  const keys = isFarmer ? FARMER_TABS : BUYER_TABS;
  const icons = { dashboard: "🏠", lots: "🌾", marketplace: "🛒", mandi: "📊", orders: "📦" };
  const labels = {
    dashboard: isFarmer ? t("sd") : t("bd"),
    lots: t("mylots"),
    marketplace: t("mk"),
    mandi: t("cmp"),
    orders: isFarmer ? t("inord") : t("myord"),
  };
  const tabDefs = keys.map((k) => ({ key: k, icon: icons[k], label: labels[k] }));

  return (
    <>
      <TopNav tabs={tabDefs} activeTab={tab} onTab={setTab} />
      <div className="wrap">
        <div className="fade-in" key={tab}>
          {isFarmer ? <FarmerDashboard tab={tab} /> : <BuyerDashboard tab={tab} />}
        </div>
      </div>
      <footer>KisanConnect · {t("footer")}</footer>
    </>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <ToastProvider>
          <Main />
        </ToastProvider>
      </AuthProvider>
    </LangProvider>
  );
}
