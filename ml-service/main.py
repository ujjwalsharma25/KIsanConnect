"""
KisanConnect ML service (FastAPI)
  python train.py                      # once (also auto-runs if the model file is missing)
  uvicorn main:app --port 8000         # then open http://localhost:8000/docs
"""
import json, os
import numpy as np, pandas as pd, joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import train

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data") if os.path.isdir(os.path.join(HERE, "..", "data")) else os.path.join(HERE, "data")
MODEL_FILE = os.path.join(HERE, "artifacts", "fair_price_model.joblib")

app = FastAPI(title="KisanConnect AI Fair Price")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DF = train.load_clean()
BUNDLE = None


def get_bundle():
    global BUNDLE
    if BUNDLE is None:
        try:
            BUNDLE = joblib.load(MODEL_FILE)
        except Exception:          # missing file or different scikit-learn version -> retrain here
            train.main()
            BUNDLE = joblib.load(MODEL_FILE)
    return BUNDLE


@app.on_event("startup")
def _warm_model():
    get_bundle()          # load the model once at boot, not on the first user request


@app.get("/health")
def health():
    return {"status": "KisanConnect ML service running", "rows": len(DF), "date": sorted(DF["date"].unique().tolist())}


@app.get("/metrics")
def metrics():
    get_bundle()
    return json.load(open(os.path.join(HERE, "artifacts", "metrics.json")))


@app.get("/fair-price")
def fair_price(commodity: str, state: str = "", district: str = "", market: str = "", variety: str = "", grade: str = ""):
    """Estimated fair modal price (Rs/quintal) for a crop, optionally narrowed to state/district/market/variety/grade."""
    rows = DF[DF["commodity"].str.lower() == commodity.strip().lower()]
    if rows.empty:
        raise HTTPException(404, f"No mandi data for '{commodity}'.")
    for col, val in (("state", state), ("district", district), ("market", market)):
        if val.strip():
            sub = rows[rows[col].str.lower() == val.strip().lower()]
            if not sub.empty:
                rows = sub
    X = rows[train.CATS].copy()
    if variety.strip():
        X["variety"] = variety.strip()
    if grade.strip():
        X["grade"] = grade.strip()
    b = get_bundle()
    pred = float(np.exp(b["model"].predict(X)).mean())
    lo, hi = b["ratio_q"]
    today = None
    try:   # official national price today (different definition/date than the model's training snapshot, so shown side-by-side, never mixed in)
        k, c = _snap_crop(commodity)
        today = {"price": c["price"][0], "date": SNAP["dates"][0], "msp": c["msp"]}
    except HTTPException:
        pass
    return {"commodity": rows["commodity"].iloc[0], "fair_price": round(pred), "low": round(pred * lo), "high": round(pred * hi),
            "based_on_markets": int(len(rows)), "data_date": sorted(DF["date"].unique().tolist()),
            "national_today": today}


@app.get("/compare")
def compare(commodity: str, top: int = 8):
    """State-wise average modal price for a crop -> bar chart data for both dashboards."""
    rows = DF[DF["commodity"].str.lower() == commodity.strip().lower()]
    if rows.empty:
        raise HTTPException(404, f"No mandi data for '{commodity}'.")
    g = rows.groupby("state")["modal"].agg(avg_price="mean", markets="count").reset_index()
    g = g.sort_values("avg_price").head(top)
    return {
        "commodity": rows["commodity"].iloc[0],
        "states": [{"state": row["state"], "avg_price": round(row["avg_price"]), "markets": int(row["markets"])} for _, row in g.iterrows()],
    }


@app.get("/top-markets")
def top_markets(commodity: str, state: str = "", limit: int = 5):
    """Cheapest and costliest individual markets for a crop (optionally within one state)."""
    rows = DF[DF["commodity"].str.lower() == commodity.strip().lower()]
    if state.strip():
        rows = rows[rows["state"].str.lower() == state.strip().lower()]
    if rows.empty:
        raise HTTPException(404, f"No mandi data for '{commodity}'" + (f" in {state}" if state else "") + ".")
    r = rows.sort_values("modal")
    cheapest = r.head(limit)[["state", "district", "market", "modal"]].to_dict(orient="records")
    costliest = r.tail(limit)[["state", "district", "market", "modal"]].to_dict(orient="records")
    return {"commodity": rows["commodity"].iloc[0], "cheapest": cheapest, "costliest": list(reversed(costliest))}


@app.get("/spread")
def spread(commodity: str):
    """Min-max price spread per crop (a proxy for how much margin exists between farm-gate and top mandi price).
    NOTE: this is a spread across mandis on one day, not a measurement of middlemen count."""
    rows = DF[DF["commodity"].str.lower() == commodity.strip().lower()]
    if rows.empty:
        raise HTTPException(404, f"No mandi data for '{commodity}'.")
    avg_min, avg_max, avg_modal = rows["min"].mean(), rows["max"].mean(), rows["modal"].mean()
    spread_pct = (avg_max - avg_min) / avg_modal * 100
    return {"commodity": rows["commodity"].iloc[0], "avg_min": round(avg_min), "avg_modal": round(avg_modal),
            "avg_max": round(avg_max), "spread_percent": round(spread_pct, 1), "markets": int(len(rows))}


@app.get("/crops")
def crops():
    vc = DF["commodity"].value_counts()
    return {"crops": [{"name": k, "markets": int(v)} for k, v in vc.items()]}


# ───────────────────────── NEW: official Agmarknet snapshot, MSP check, sell-now advisor, explainability ─────────────────────────
SNAP = json.load(open(os.path.join(DATA, "national_snapshot.json"), encoding="utf-8"))
try:
    ONION_HIST = json.load(open(os.path.join(DATA, "onion_history_summary.json"), encoding="utf-8"))
except Exception:
    ONION_HIST = None


def _snap_crop(name):
    n = name.strip().lower()
    for k, v in SNAP["crops"].items():
        if k.lower() == n or k.lower().startswith(n) or n.startswith(k.lower()):
            return k, v
    raise HTTPException(404, f"'{name}' is not in the official national price report (crops covered: {', '.join(SNAP['crops'])}).")


def _latest_day_partial():
    """Across ALL crops, if the newest day's arrivals are far below the previous 2 days, the report day is
    almost certainly still incomplete — so we don't treat it as a real supply drop."""
    ch = []
    for c in SNAP["crops"].values():
        a = c["arrival_mt"]
        if a[0] is not None and a[1] and a[2]:
            ch.append(a[0] / ((a[1] + a[2]) / 2) - 1)
    return bool(ch) and float(np.median(ch)) < -0.4


PARTIAL = _latest_day_partial()


def _pct(a, b):
    return None if (a is None or b in (None, 0)) else round((a - b) / b * 100, 1)


@app.get("/benchmark")
def benchmark(commodity: str, rate: float = 0):
    """Official Agmarknet national price (last 3 days) + MSP check for the farmer's asking rate."""
    k, c = _snap_crop(commodity)
    p, a = c["price"], c["arrival_mt"]
    out = {"commodity": k, "group": c["group"], "dates": SNAP["dates"], "price": p, "arrival_mt": a,
           "price_change_2d_pct": _pct(p[0], p[2]), "msp": c["msp"], "source": SNAP["report"]}
    if rate and c["msp"]:
        d = _pct(rate, c["msp"])
        out["msp_check"] = {"rate": rate, "msp": c["msp"], "diff_pct": d,
                            "status": "below_msp" if rate < c["msp"] else "above_msp"}
    return out


@app.get("/advisor")
def advisor(commodity: str, role: str = "farmer"):
    """Sell-now / buy-now vs wait: transparent rules on 3 days of official price + arrival data. NOT a forecast.
    Returns structured `facts` + `codes` so the UI can render every sentence in Hindi OR English (no mixed language);
    `reasons` is an English fallback for API consumers."""
    k, c = _snap_crop(commodity)
    buyer = role.strip().lower() == "buyer"
    p, a = c["price"], c["arrival_mt"]
    chg = _pct(p[0], p[2])
    if PARTIAL:   # newest day looks incompletely reported -> compare the two complete days instead
        arr_chg, basis = _pct(a[1], a[2]), "partial"
    else:
        prev = [x for x in a[1:] if x]
        arr_chg, basis = (_pct(a[0], float(np.mean(prev))) if prev and a[0] is not None else None), "avg"
    codes, reasons = ["price_move"], [f"National price {p[2]:.0f} -> {p[0]:.0f} Rs/q over 3 days ({chg:+.1f}%)."]
    if arr_chg is not None:
        codes.append("arrivals"); reasons.append(f"Arrivals {arr_chg:+.0f}% ({basis}).")
    up, down = chg is not None and chg >= 2, chg is not None and chg <= -2
    thin, glut = arr_chg is not None and arr_chg < -20, arr_chg is not None and arr_chg > 20
    if buyer:
        if up and thin:
            verdict, cd = "BUY_NOW", "b_buy"; reasons.append("Prices rising while supply shrinks - buying now locks today's rate.")
        elif down and glut:
            verdict, cd = "WAIT", "b_wait"; reasons.append("Prices falling while arrivals rise - waiting may get a cheaper rate.")
        else:
            verdict, cd = "NEUTRAL", "b_neutral"; reasons.append("No clear signal - buy according to your need.")
    else:
        if down:
            verdict, cd = "SELL_NOW", "f_sell"; reasons.append("Price is sliding - locking a price now protects you.")
        elif up and thin:
            verdict, cd = "WAIT", "f_wait"; reasons.append("Price rising while supply is thinning - a short wait may pay.")
        elif up:
            verdict, cd = "NEUTRAL", "f_up"; reasons.append("Price is up but supply is not tight - fine to sell at a good rate.")
        else:
            verdict, cd = "NEUTRAL", "f_flat"; reasons.append("No strong move in the last 3 days.")
    codes.append(cd)
    below = bool(c["msp"] and p[0] is not None and p[0] < c["msp"])
    if below and not buyer:
        codes.append("msp_below"); reasons.append(f"Market price is below MSP (Rs {c['msp']:.0f}).")
    hist = None
    if k.lower() == "onion" and ONION_HIST:
        hist = {"from": ONION_HIST["from"], "to": ONION_HIST["to"], "rows": ONION_HIST["rows"], "oct_to_nov": ONION_HIST["oct_to_nov_pct"]}
    return {"commodity": k, "role": "buyer" if buyer else "farmer", "verdict": verdict, "codes": codes, "reasons": reasons,
            "facts": {"price_from": p[2], "price_to": p[0], "price_pct": chg, "arr_pct": arr_chg, "arr_basis": basis, "msp": c["msp"],
                      "arr_dates": [SNAP["dates"][2], SNAP["dates"][1]] if basis == "partial" else [SNAP["dates"][0], None]},
            "history": hist, "dates": SNAP["dates"], "price": p,
            "disclaimer": "3-day signal from official Agmarknet data, not a price forecast."}


@app.get("/onion-history")
def onion_history():
    if not ONION_HIST:
        raise HTTPException(404, "History not available.")
    return ONION_HIST


@app.get("/states")
def states(commodity: str):
    rows = DF[DF["commodity"].str.lower() == commodity.strip().lower()]
    if rows.empty:
        raise HTTPException(404, f"No mandi data for '{commodity}'.")
    return {"states": sorted(rows["state"].unique().tolist())}


@app.get("/explain")
def explain(commodity: str, state: str = "", variety: str = "", market: str = ""):
    """'Why this price?' — ablation on the Ridge model: how much each chosen factor moves the estimate
    (prediction with the factor vs. the same prediction with that factor blanked out). Approximate, not causal."""
    rows = DF[DF["commodity"].str.lower() == commodity.strip().lower()]
    if rows.empty:
        raise HTTPException(404, f"No mandi data for '{commodity}'.")
    X = rows[train.CATS].copy()
    chosen = {"state": state, "market": market, "variety": variety}
    for col, val in chosen.items():
        if val.strip():
            X[col] = val.strip()
        else:
            chosen[col] = ""
    b = get_bundle(); mdl = b["model"]
    def lp(df):
        return float(np.mean(mdl.predict(df)))
    # neutralise district (not user-chosen) so only chosen factors matter
    X["district"] = "__none__"
    full = lp(X)
    blank = X.copy()
    for col in chosen:           # only the factors the user picked are blanked, so base -> estimate is explained by them
        if chosen[col].strip():
            blank[col] = "__none__"
    base = lp(blank)
    factors = []
    for col, val in chosen.items():
        if not val.strip():
            continue
        Y = X.copy(); Y[col] = "__none__"
        factors.append({"factor": col, "value": val.strip(), "impact_pct": round((np.exp(full - lp(Y)) - 1) * 100, 1)})
    return {"commodity": rows["commodity"].iloc[0], "crop_base_price": round(float(np.exp(base))),
            "estimate": round(float(np.exp(full))), "factors": factors,
            "note": "Ablation on a Ridge model trained on 2,724 mandi quotes — shows direction & size, not causation."}
