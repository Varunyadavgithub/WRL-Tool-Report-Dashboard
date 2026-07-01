import crypto from "crypto";

// Hash is computed over the exact bytes written to/read from disk, so
// verification is a literal byte-for-byte check, never a re-serialization.
export const computeTemplateHash = (jsonString) =>
  crypto.createHash("sha256").update(jsonString, "utf8").digest("hex");

// `skipped: true` means no hash was on record yet (a pre-Phase-1 legacy row)
// — callers should treat this as "not yet backfilled", not as corruption.
export const verifyTemplateHash = (jsonString, expectedHash) => {
  if (!expectedHash) return { valid: true, skipped: true };
  const actual = computeTemplateHash(jsonString);
  return { valid: actual === expectedHash, skipped: false, actual, expected: expectedHash };
};

export const computeTemplateStats = ({ defaultSections = [] } = {}) => {
  let stageCount = 0;
  let checkpointCount = 0;
  let requiredCheckpointCount = 0;

  (defaultSections || []).forEach((section) => {
    (section.stages || []).forEach((stage) => {
      stageCount++;
      (stage.checkPoints || []).forEach((cp) => {
        checkpointCount++;
        if (cp.required) requiredCheckpointCount++;
      });
    });
  });

  return {
    sectionCount: (defaultSections || []).length,
    stageCount,
    checkpointCount,
    requiredCheckpointCount,
  };
};
