// Thin fetch wrapper. In dev, Vite proxies /api -> http://localhost:5000 (see vite.config.js).
// In production this file is served BY the Express backend itself, so relative /api just works too.
export async function api(path, { method = "GET", json, body, token, nobkMsg = "Cannot reach server" } = {}) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  let payload = body;
  if (json) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(json);
  }
  let res;
  try {
    res = await fetch("/api" + path, { method, headers, body: payload });
  } catch (e) {
    throw new Error(nobkMsg);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || (data.errors && data.errors[0].msg) || "Request failed");
    err.code = data.code;
    throw err;
  }
  return data;
}


// Shrink a photo in the browser (max 900px, JPEG ~70%) before upload: ~80-150 KB instead of several MB.
export function compressImage(file, maxSide = 900, quality = 0.72) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith("image/")) return resolve(file);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(url); resolve(b ? new File([b], "photo.jpg", { type: "image/jpeg" }) : file); }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
