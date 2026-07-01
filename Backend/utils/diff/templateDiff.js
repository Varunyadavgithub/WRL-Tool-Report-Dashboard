// Pure functions, no I/O. Compares two parsed template configs ({defaultSections})
// by section/stage/checkpoint `id`, which is permanent across versions
// (crypto.randomUUID() going forward, stable Date.now()-style ids for legacy
// data — neither is ever regenerated on edit). This makes id-based matching
// reliable for detecting renames vs adds/removes, unlike name-based matching.
//
// v1 limitation (documented, not a bug): array position is never read, only
// id-map membership and field equality — reordering sections/stages without
// adding/removing them is not detected as a change.

const CHECKPOINT_TEXT_FIELDS = ["checkPoint", "method", "specification"];

const buildIdMap = (list) => {
  const map = new Map();
  (list || []).forEach((node) => {
    if (node?.id != null) map.set(node.id, node);
  });
  return map;
};

const diffCheckpoints = (oldCheckpoints, newCheckpoints) => {
  const oldMap = buildIdMap(oldCheckpoints);
  const newMap = buildIdMap(newCheckpoints);

  const added = [];
  const removed = [];
  const modified = [];

  for (const [id, cp] of newMap) {
    if (!oldMap.has(id)) added.push({ id, checkPoint: cp.checkPoint, method: cp.method, specification: cp.specification, required: !!cp.required });
  }
  for (const [id, cp] of oldMap) {
    if (!newMap.has(id)) removed.push({ id, checkPoint: cp.checkPoint, method: cp.method, specification: cp.specification, required: !!cp.required });
  }
  for (const [id, oldCp] of oldMap) {
    const newCp = newMap.get(id);
    if (!newCp) continue;

    const fields = [];
    for (const field of CHECKPOINT_TEXT_FIELDS) {
      const a = String(oldCp[field] ?? "");
      const b = String(newCp[field] ?? "");
      if (a !== b) fields.push({ field, from: oldCp[field] ?? "", to: newCp[field] ?? "" });
    }
    if (Boolean(oldCp.required) !== Boolean(newCp.required)) {
      fields.push({ field: "required", from: !!oldCp.required, to: !!newCp.required });
    }
    if (fields.length > 0) {
      modified.push({ id, checkPoint: newCp.checkPoint, fields });
    }
  }

  return { added, removed, modified };
};

const diffStages = (oldStages, newStages) => {
  const oldMap = buildIdMap(oldStages);
  const newMap = buildIdMap(newStages);

  const added = [];
  const removed = [];
  const renamed = [];
  const modified = [];

  for (const [id, stage] of newMap) {
    if (!oldMap.has(id)) {
      added.push({ id, stageName: stage.stageName, checkpointCount: (stage.checkPoints || []).length });
    }
  }
  for (const [id, stage] of oldMap) {
    if (!newMap.has(id)) {
      removed.push({ id, stageName: stage.stageName, checkpointCount: (stage.checkPoints || []).length });
    }
  }

  for (const [id, oldStage] of oldMap) {
    const newStage = newMap.get(id);
    if (!newStage) continue;

    const oldName = (oldStage.stageName || "").trim();
    const newName = (newStage.stageName || "").trim();
    const isRenamed = oldName !== newName;
    if (isRenamed) renamed.push({ id, from: oldStage.stageName, to: newStage.stageName });

    const checkpoints = diffCheckpoints(oldStage.checkPoints, newStage.checkPoints);
    const hasChildChange =
      checkpoints.added.length || checkpoints.removed.length || checkpoints.modified.length;

    if (isRenamed || hasChildChange) {
      modified.push({
        id,
        stageName: newStage.stageName,
        renamed: isRenamed ? { from: oldStage.stageName, to: newStage.stageName } : null,
        checkpoints,
      });
    }
  }

  return { added, removed, renamed, modified };
};

const diffSections = (oldSections, newSections) => {
  const oldMap = buildIdMap(oldSections);
  const newMap = buildIdMap(newSections);

  const added = [];
  const removed = [];
  const renamed = [];
  const modified = [];

  for (const [id, section] of newMap) {
    if (!oldMap.has(id)) {
      const stages = section.stages || [];
      added.push({
        id,
        sectionName: section.sectionName,
        stageCount: stages.length,
        checkpointCount: stages.reduce((t, s) => t + (s.checkPoints || []).length, 0),
      });
    }
  }
  for (const [id, section] of oldMap) {
    if (!newMap.has(id)) {
      const stages = section.stages || [];
      removed.push({
        id,
        sectionName: section.sectionName,
        stageCount: stages.length,
        checkpointCount: stages.reduce((t, s) => t + (s.checkPoints || []).length, 0),
      });
    }
  }

  for (const [id, oldSection] of oldMap) {
    const newSection = newMap.get(id);
    if (!newSection) continue;

    const oldName = (oldSection.sectionName || "").trim();
    const newName = (newSection.sectionName || "").trim();
    const isRenamed = oldName !== newName;
    if (isRenamed) renamed.push({ id, from: oldSection.sectionName, to: newSection.sectionName });

    const stages = diffStages(oldSection.stages, newSection.stages);
    const hasChildChange =
      stages.added.length || stages.removed.length || stages.renamed.length || stages.modified.length;

    if (isRenamed || hasChildChange) {
      modified.push({
        id,
        sectionName: newSection.sectionName,
        renamed: isRenamed ? { from: oldSection.sectionName, to: newSection.sectionName } : null,
        stages,
      });
    }
  }

  return { added, removed, renamed, modified };
};

export const diffTemplateConfigs = (oldConfig, newConfig) => {
  const sections = diffSections(oldConfig?.defaultSections, newConfig?.defaultSections);

  let stagesAdded = 0, stagesRemoved = 0, stagesRenamed = 0;
  let checkpointsAdded = 0, checkpointsRemoved = 0, checkpointsModified = 0;

  sections.modified.forEach((sec) => {
    stagesAdded += sec.stages.added.length;
    stagesRemoved += sec.stages.removed.length;
    stagesRenamed += sec.stages.renamed.length;
    sec.stages.modified.forEach((stage) => {
      checkpointsAdded += stage.checkpoints.added.length;
      checkpointsRemoved += stage.checkpoints.removed.length;
      checkpointsModified += stage.checkpoints.modified.length;
    });
  });

  const summary = {
    sectionsAdded: sections.added.length,
    sectionsRemoved: sections.removed.length,
    sectionsRenamed: sections.renamed.length,
    sectionsModified: sections.modified.length,
    stagesAdded,
    stagesRemoved,
    stagesRenamed,
    checkpointsAdded,
    checkpointsRemoved,
    checkpointsModified,
  };
  summary.hasChanges = Object.values(summary).some((v) => v > 0);

  return { summary, sections };
};

export const flattenTemplateDiff = (diff) => {
  const out = [];

  diff.sections.added.forEach((s) => out.push({ field: "Section Added", from: null, to: s.sectionName }));
  diff.sections.removed.forEach((s) => out.push({ field: "Section Removed", from: s.sectionName, to: null }));
  diff.sections.renamed.forEach((s) => out.push({ field: "Section Renamed", from: s.from, to: s.to }));

  diff.sections.modified.forEach((sec) => {
    const secLabel = sec.sectionName;

    (sec.stages.added || []).forEach((st) =>
      out.push({ field: `Stage Added - ${secLabel}`, from: null, to: st.stageName }));
    (sec.stages.removed || []).forEach((st) =>
      out.push({ field: `Stage Removed - ${secLabel}`, from: st.stageName, to: null }));
    (sec.stages.renamed || []).forEach((st) =>
      out.push({ field: `Stage Renamed - ${secLabel}`, from: st.from, to: st.to }));

    (sec.stages.modified || []).forEach((stage) => {
      const stageLabel = `${secLabel} > ${stage.stageName}`;

      (stage.checkpoints.added || []).forEach((cp) =>
        out.push({ field: `Checkpoint Added - ${stageLabel}`, from: null, to: cp.checkPoint }));
      (stage.checkpoints.removed || []).forEach((cp) =>
        out.push({ field: `Checkpoint Removed - ${stageLabel}`, from: cp.checkPoint, to: null }));
      (stage.checkpoints.modified || []).forEach((cp) => {
        cp.fields.forEach((f) => {
          const fieldLabel = f.field === "checkPoint" ? "text" : f.field === "specification" ? "spec" : f.field;
          out.push({
            field: `Checkpoint Modified (${fieldLabel}) - ${stageLabel} > ${cp.checkPoint}`,
            from: f.field === "required" ? (f.from ? "Required" : "Optional") : f.from,
            to: f.field === "required" ? (f.to ? "Required" : "Optional") : f.to,
          });
        });
      });
    });
  });

  return out;
};
