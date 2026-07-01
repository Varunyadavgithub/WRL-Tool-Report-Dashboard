import logoUrl from "../assets/logo.png";

// Converts the local WRL logo asset to a base64 PNG data URL so it can be
// embedded in jsPDF (addImage) and HTML-table Excel exports (<img src>).
// Native logo.png is 512x256 (2:1 aspect ratio).
const loadImageAsBase64 = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

// Cached across all report pages — the image only needs to be loaded once
// per session, regardless of how many exports the user triggers.
let cachedLogoPromise = null;
export const getWrlLogoBase64 = () => {
  if (!cachedLogoPromise) cachedLogoPromise = loadImageAsBase64(logoUrl);
  return cachedLogoPromise;
};

export const LOGO_ASPECT = 512 / 256; // width / height
