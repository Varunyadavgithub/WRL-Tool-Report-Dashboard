// getUserMedia() only works in a secure context (HTTPS, or the
// browser-special-cased http://localhost). Over plain HTTP in production,
// `navigator.mediaDevices` itself is undefined — callers should check this
// before touching getUserMedia and fall back to a native
// `<input type="file" accept="image/*" capture="environment">` instead,
// which still lets mobile browsers open the camera directly.
export const canUseGetUserMedia = () =>
  window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
