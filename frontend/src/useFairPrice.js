import { api } from "./api";

// module-level cache so repeated lookups for the same crop don't re-hit the API
const cache = {};

export async function getFairPrice(crop, token) {
  const k = crop.toLowerCase();
  if (cache[k]) return cache[k];
  try {
    const d = await api("/market/fair-price?commodity=" + encodeURIComponent(crop), { token });
    cache[k] = d;
    return d;
  } catch {
    return null;
  }
}

export function dealLabel(rate, fp, t) {
  if (!fp) return null;
  const r = rate / fp.fair_price;
  if (r <= 0.9) return { cls: "g", text: "🟢 " + t("great") };
  if (r >= 1.15) return { cls: "n", text: "🔴 " + t("highp") };
  return { cls: "", text: "🔵 " + t("fairtag") };
}
