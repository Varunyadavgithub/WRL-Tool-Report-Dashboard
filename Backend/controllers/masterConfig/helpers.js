// Shared field-coercion helpers used across every Master Config sub-module.
export const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
export const strOrNull = (v) => (v === "" || v === null || v === undefined ? null : String(v));
export const toBit = (v) => (v ? 1 : 0);
