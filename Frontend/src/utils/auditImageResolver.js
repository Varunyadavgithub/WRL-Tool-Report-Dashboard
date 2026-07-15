import { baseURL } from "../assets/assets.js";

// Shared checkpoint-image resolution for the audit PDF/Excel exporters —
// fetches each unique image once (by saved filename or embedded base64) and
// re-bakes it through a canvas so EXIF-rotated phone photos come out
// upright in the exported file. jsPDF's addImage() and ExcelJS's
// addImage() both embed the raw bytes as-is and ignore the EXIF
// Orientation tag that phone cameras write (unlike <img> rendering, which
// honours it) — drawing through a canvas forces the browser's own
// EXIF-aware decoder to bake the corrected pixels into a flat image first.

const fetchImageAsBase64 = async (url) => {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// Checkpoint image values are either a filename string or an object
// { name, data } (data already base64) — normalise to a cache key.
export const imageKey = (val) => {
  if (!val) return null;
  if (typeof val === "object") return val.name || JSON.stringify(val);
  return String(val);
};

export const normalizeImageOrientation = (dataUrl) =>
  new Promise((resolve) => {
    if (!dataUrl) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

// Walks every checkpoint in `sections`, resolves each unique image found in
// an `imageColIds` column to a normalized (EXIF-corrected) base64 JPEG, and
// returns a Map keyed by imageKey() for synchronous lookup while building
// the export document.
export const resolveCheckpointImages = async (sections, imageColIds) => {
  const cache = new Map();
  if (!imageColIds || imageColIds.size === 0) return cache;

  const toFetch = new Map();
  (sections || []).forEach((section) => {
    (section?.stages || []).forEach((st) => {
      (st.checkPoints || []).forEach((cp) => {
        imageColIds.forEach((colId) => {
          const val = cp[colId];
          const key = imageKey(val);
          if (key && !toFetch.has(key)) toFetch.set(key, val);
        });
      });
    });
  });

  await Promise.all(
    [...toFetch.entries()].map(async ([key, val]) => {
      let raw = null;
      if (typeof val === "object" && val.data) {
        raw = val.data;
      } else if (typeof val === "string") {
        raw = await fetchImageAsBase64(`${baseURL}audit-report/images/${val}`);
      }
      cache.set(key, await normalizeImageOrientation(raw));
    }),
  );

  return cache;
};
