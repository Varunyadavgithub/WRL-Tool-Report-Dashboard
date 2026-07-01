import { AppError } from "../AppError.js";

export class ValidationError extends AppError {
  constructor(errors) {
    super(`Template validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"})`, 400);
    this.errors = errors; // [{ path, message }]
  }
}

const VALID_COLUMN_TYPES = ["text", "number", "status", "date", "image"];

// Accepts legacy Date.now()-based ids ("1719391234567_3") AND UUIDs — the
// integrity requirement is non-blankness + uniqueness, not a specific format.
// IDs are never reformatted or regenerated on edit.
const isValidId = (id) => typeof id === "string" && id.trim().length > 0;
const isBlank = (val) => !val || !String(val).trim();

/**
 * Validates a template content payload before it is saved. Throws
 * ValidationError (statusCode 400, carries `.errors`) on the first pass that
 * finds any issue; callers should call this before any file/SQL writes.
 */
export const validateTemplatePayload = ({ headerConfig, infoFields, columns, defaultSections } = {}) => {
  const errors = [];
  const addError = (pathStr, message) => errors.push({ path: pathStr, message });

  // ── Columns ──
  const colIds = new Set();
  (columns || []).forEach((c, i) => {
    if (!isValidId(c.id)) addError(`columns[${i}].id`, "Column id is required");
    else if (colIds.has(c.id)) addError(`columns[${i}].id`, `Duplicate column id: ${c.id}`);
    else colIds.add(c.id);

    if (isBlank(c.name)) addError(`columns[${i}].name`, "Column name cannot be blank");
    if (c.type && !VALID_COLUMN_TYPES.includes(c.type)) {
      addError(`columns[${i}].type`, `Invalid column type: ${c.type}`);
    }
  });

  // ── Info fields ──
  const fieldIds = new Set();
  (infoFields || []).forEach((f, i) => {
    if (!isValidId(f.id)) addError(`infoFields[${i}].id`, "Field id is required");
    else if (fieldIds.has(f.id)) addError(`infoFields[${i}].id`, `Duplicate field id: ${f.id}`);
    else fieldIds.add(f.id);

    if (isBlank(f.name)) addError(`infoFields[${i}].name`, "Field name cannot be blank");
  });

  // ── Sections / stages / checkpoints ──
  const sectionIds = new Set();
  const sectionNames = new Set();

  (defaultSections || []).forEach((section, si) => {
    if (!isValidId(section.id)) addError(`defaultSections[${si}].id`, "Section id is required");
    else if (sectionIds.has(section.id)) addError(`defaultSections[${si}].id`, `Duplicate section id: ${section.id}`);
    else sectionIds.add(section.id);

    if (isBlank(section.sectionName)) {
      addError(`defaultSections[${si}].sectionName`, "Section name cannot be blank");
    } else {
      const key = section.sectionName.trim().toLowerCase();
      if (sectionNames.has(key)) {
        addError(`defaultSections[${si}].sectionName`, `Duplicate section name: "${section.sectionName}"`);
      } else {
        sectionNames.add(key);
      }
    }

    const stageIds = new Set();
    const stageNames = new Set();

    (section.stages || []).forEach((stage, sti) => {
      const stagePath = `defaultSections[${si}].stages[${sti}]`;

      if (!isValidId(stage.id)) addError(`${stagePath}.id`, "Stage id is required");
      else if (stageIds.has(stage.id)) addError(`${stagePath}.id`, `Duplicate stage id: ${stage.id}`);
      else stageIds.add(stage.id);

      if (isBlank(stage.stageName)) {
        addError(`${stagePath}.stageName`, "Stage name cannot be blank");
      } else {
        const key = stage.stageName.trim().toLowerCase();
        if (stageNames.has(key)) {
          addError(`${stagePath}.stageName`, `Duplicate stage name "${stage.stageName}" in section "${section.sectionName}"`);
        } else {
          stageNames.add(key);
        }
      }

      const cpIds = new Set();
      (stage.checkPoints || []).forEach((cp, cpi) => {
        const cpPath = `${stagePath}.checkPoints[${cpi}]`;
        if (!isValidId(cp.id)) addError(`${cpPath}.id`, "Checkpoint id is required");
        else if (cpIds.has(cp.id)) addError(`${cpPath}.id`, `Duplicate checkpoint id: ${cp.id}`);
        else cpIds.add(cp.id);

        if (isBlank(cp.checkPoint)) addError(`${cpPath}.checkPoint`, "Checkpoint text cannot be blank");
        // Checkpoint TEXT uniqueness is intentionally not enforced — the same
        // wording legitimately recurs across different stages/sections.
      });
    });
  });

  if (errors.length) throw new ValidationError(errors);
};
