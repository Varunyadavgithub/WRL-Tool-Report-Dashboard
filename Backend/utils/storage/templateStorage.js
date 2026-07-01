import path from "path";
import fs from "fs";
import { promisify } from "util";
import { DIRS } from "./config.js";
import { AppError } from "../AppError.js";
import { computeTemplateHash, computeTemplateStats } from "./templateIntegrity.js";

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);

// Legacy flat directory — pre-Phase-5 files lived here; all content now in SQL.
const TEMPLATES_DIR = DIRS.auditTemplates;
const BACKUPS_DIR = DIRS.templateBackups ?? null;

// Filter out undefined entries — active/archive subdirs were removed in Phase 5
// once all template content moved to AuditTemplateContent (SQL). Only the flat
// dir remains for any future emergency reads, though no files exist there now.
const SEARCH_DIRS = [DIRS.templatesActive, DIRS.templatesArchive, TEMPLATES_DIR].filter(Boolean);

const MAX_TEMPLATE_JSON_BYTES = 5 * 1024 * 1024; // 5MB — generous for any realistic audit template

/* ===================== PATH SAFETY (item 21) ===================== */

// Single chokepoint for every fs path this module builds — blocks directory
// traversal / path injection regardless of where the filename string came from.
const isSafeFileName = (fileName) =>
  typeof fileName === "string" &&
  fileName.length > 0 &&
  !fileName.includes("..") &&
  !fileName.includes("/") &&
  !fileName.includes("\\") &&
  path.basename(fileName) === fileName &&
  /^[a-zA-Z0-9_-]+\.json$/.test(fileName);

const assertSafeFileName = (fileName) => {
  if (!isSafeFileName(fileName)) {
    throw new AppError(`Invalid template filename: ${fileName}`, 400);
  }
  return fileName;
};

const assertSizeOk = (jsonString) => {
  const bytes = Buffer.byteLength(jsonString, "utf8");
  if (bytes > MAX_TEMPLATE_JSON_BYTES) {
    throw new AppError(
      `Template JSON exceeds maximum allowed size (${MAX_TEMPLATE_JSON_BYTES} bytes)`,
      413,
    );
  }
  return bytes;
};

/* ===================== HELPERS ===================== */

const sanitizeForFilename = (str) =>
  (str ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .substring(0, 100);

const generateTemplateFileName = (templateName, version = "01") => {
  const name = sanitizeForFilename(templateName);
  if (!name)
    throw new AppError("Template name is required for filename generation", 400);
  return `${name}_${sanitizeForFilename(version)}.json`;
};

// Phase 1: filename also embeds templateCode so two templates that happen to
// share a sanitized name can never collide on the same version file.
const generateVersionedFileName = (templateName, templateCode, version) => {
  const name = sanitizeForFilename(templateName);
  if (!name)
    throw new AppError("Template name is required for filename generation", 400);
  const code = sanitizeForFilename(templateCode || "NOCODE");
  const ver = sanitizeForFilename(version || "01");
  return `${name}_${code}_${ver}.json`;
};

// "01" -> "02", "09" -> "10" ... falls back gracefully for non-numeric legacy values.
const nextVersion = (currentVersion) => {
  const n = parseInt(currentVersion, 10);
  if (Number.isNaN(n)) return "02";
  return String(n + 1).padStart(2, "0");
};

const getTemplateFilePath = (fileName, baseDir = TEMPLATES_DIR) =>
  path.join(baseDir, assertSafeFileName(fileName));

// Read-oriented lookup: searches active -> archive -> legacy flat dir, so
// every historical version and every pre-Phase-1 file remains loadable
// forever without ever being moved or rewritten.
const findExistingTemplateFilePath = (fileName) => {
  if (!isSafeFileName(fileName)) return null;
  for (const dir of SEARCH_DIRS) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

/**
 * Returns a filename that doesn't already exist on disk, appending _1, _2… if needed.
 * Pass excludeFileName to ignore the file being replaced (update scenario).
 */
const getUniqueFileName = async (
  templateName,
  version,
  excludeFileName = null,
) => {
  const base = generateTemplateFileName(templateName, version);
  let candidate = base;
  let counter = 1;

  while (
    fs.existsSync(getTemplateFilePath(candidate)) &&
    candidate !== excludeFileName
  ) {
    if (counter > 100) throw new AppError("Too many duplicate template names", 500);
    candidate = `${base.replace(".json", "")}_${counter++}.json`;
  }

  return candidate;
};

/* ===================== SAVE (legacy, overwrite-in-place) ===================== */
// Retained for backward compatibility. New code (createTemplate/updateTemplate/
// duplicateTemplate) uses saveNewTemplateVersion below instead, which never
// overwrites an existing file.

/**
 * Saves (or overwrites) a template JSON file.
 * Pass existingFileName to reuse the same filename on update.
 */
export const saveTemplateFile = async ({
  templateName,
  version = "01",
  templateCode,
  headerConfig,
  infoFields,
  columns,
  defaultSections,
  approvalStatus = "draft",
  createdByUser = null,
  existingFileName = null,
}) => {
  const fileName =
    existingFileName && fs.existsSync(getTemplateFilePath(existingFileName))
      ? existingFileName
      : await getUniqueFileName(templateName, version);

  const filePath = getTemplateFilePath(fileName);
  const now = new Date().toISOString();

  const jsonString = JSON.stringify(
    {
      templateCode: templateCode ?? null,
      templateName,
      version,
      headerConfig: headerConfig ?? {},
      infoFields: infoFields ?? [],
      columns: columns ?? [],
      defaultSections: defaultSections ?? [],
      approvalStatus: approvalStatus ?? "draft",
      createdByUser: createdByUser ?? null,
      savedAt: now,
      updatedAt: now,
    },
    null,
    2,
  );
  assertSizeOk(jsonString);

  await writeFileAsync(filePath, jsonString, "utf8");

  console.log(`Template file saved: ${fileName}`);
  return { success: true, fileName, filePath };
};

/* ===================== SAVE (Phase 1, immutable versioned) ===================== */

/**
 * Writes a brand-new, never-reused version file into the active templates
 * folder. Returns the file info plus the hash/stats computed from the exact
 * string written to disk, so callers can persist them to SQL without a
 * separate read-back (which would risk a non-byte-identical re-serialization).
 */
export const saveNewTemplateVersion = async ({
  templateName,
  templateCode,
  version = "01",
  headerConfig,
  infoFields,
  columns,
  defaultSections,
  approvalStatus = "draft",
  createdByUser = null,
}) => {
  let fileName = generateVersionedFileName(templateName, templateCode, version);
  let counter = 1;
  while (fs.existsSync(getTemplateFilePath(fileName, DIRS.templatesActive))) {
    if (counter > 100) throw new AppError("Too many filename collisions for this version", 500);
    fileName = generateVersionedFileName(templateName, templateCode, version).replace(
      ".json",
      `_${counter++}.json`,
    );
  }

  const now = new Date().toISOString();
  const payload = {
    templateCode: templateCode ?? null,
    templateName,
    version,
    headerConfig: headerConfig ?? {},
    infoFields: infoFields ?? [],
    columns: columns ?? [],
    defaultSections: defaultSections ?? [],
    approvalStatus: approvalStatus ?? "draft",
    createdByUser: createdByUser ?? null,
    jsonSchemaVersion: "1",
    savedAt: now,
    updatedAt: now,
  };
  const jsonString = JSON.stringify(payload, null, 2);
  assertSizeOk(jsonString);

  const filePath = getTemplateFilePath(fileName, DIRS.templatesActive);
  await writeFileAsync(filePath, jsonString, "utf8");

  console.log(`Template version file saved: ${fileName}`);

  return {
    success: true,
    fileName,
    filePath,
    sizeBytes: Buffer.byteLength(jsonString, "utf8"),
    hash: computeTemplateHash(jsonString),
    stats: computeTemplateStats(payload),
  };
};

/**
 * Moves the previous active-version file into the archive folder, fully
 * intact. Must only be called after the new version file is written and the
 * SQL update has committed, so a mid-failure never leaves a template with no
 * active file. No-op (returns null) for files outside templatesActive —
 * i.e. legacy pre-Phase-1 files are never moved.
 */
export const archivePreviousVersion = async (fileName) => {
  if (!fileName || !isSafeFileName(fileName)) return null;
  const activePath = path.join(DIRS.templatesActive, fileName);
  if (!fs.existsSync(activePath)) return null;

  const archivePath = path.join(DIRS.templatesArchive, fileName);
  await fs.promises.rename(activePath, archivePath);
  console.log(`Template version archived: ${fileName}`);
  return archivePath;
};

/* ===================== READ ===================== */

export const readTemplateFile = async (fileName) => {
  if (!fileName) {
    console.warn("readTemplateFile: no filename");
    return null;
  }

  const filePath = findExistingTemplateFilePath(fileName);
  if (!filePath) {
    console.warn(`Template not found: ${fileName}`);
    return null;
  }

  const content = await readFileAsync(filePath, "utf8");
  return JSON.parse(content);
};

/**
 * Returns the raw file string (not parsed) for byte-exact hash verification.
 * A parsed-then-restringified object will NOT necessarily byte-match the
 * original file, so hash checks must always go through this function.
 */
export const readTemplateFileRaw = async (fileName) => {
  if (!fileName) return null;
  const filePath = findExistingTemplateFilePath(fileName);
  if (!filePath) return null;
  return readFileAsync(filePath, "utf8");
};

/* ===================== DELETE ===================== */

export const deleteTemplateFile = async (fileName) => {
  if (!fileName) {
    console.warn("deleteTemplateFile: no filename");
    return false;
  }

  const filePath = findExistingTemplateFilePath(fileName);
  if (!filePath) {
    console.warn(`Template not found: ${fileName}`);
    return false;
  }

  await unlinkAsync(filePath);
  console.log(`Template file deleted: ${fileName}`);
  return true;
};

/* ===================== UPDATE (legacy, with rename support) ===================== */

export const updateTemplateFile = async ({
  oldFileName,
  templateName,
  version,
  ...rest
}) => {
  const newFileName = generateTemplateFileName(templateName, version);
  const nameChanged = oldFileName && oldFileName !== newFileName;

  let targetFileName;

  if (nameChanged) {
    // Resolve any clash with an existing file that isn't the one we're replacing
    targetFileName = fs.existsSync(getTemplateFilePath(newFileName))
      ? await getUniqueFileName(templateName, version, oldFileName)
      : newFileName;

    await deleteTemplateFile(oldFileName);
  } else {
    targetFileName = oldFileName ?? null;
  }

  return saveTemplateFile({
    templateName,
    version,
    ...rest,
    existingFileName: targetFileName,
  });
};

/* ===================== BACKUP & RENAME ===================== */

export const backupTemplateFile = async (fileName) => {
  if (!fileName) throw new AppError("Filename is required for backup", 400);
  const filePath = findExistingTemplateFilePath(fileName);
  if (!filePath) throw new AppError(`Template not found: ${fileName}`, 404);
  if (!BACKUPS_DIR) {
    console.warn(`backupTemplateFile: backups directory not configured, skipping backup of ${fileName}`);
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `${fileName.replace(".json", "")}_backup_${timestamp}.json`;
  const backupPath = path.join(BACKUPS_DIR, backupName);

  await writeFileAsync(
    backupPath,
    await readFileAsync(filePath, "utf8"),
    "utf8",
  );
  console.log(`Template backup created: ${backupName}`);
  return backupName;
};

export const renameTemplateFile = async (
  oldFileName,
  newTemplateName,
  newVersion,
) => {
  const oldPath = findExistingTemplateFilePath(oldFileName);
  if (!oldPath) throw new AppError(`Template not found: ${oldFileName}`, 404);

  const content = await readFileAsync(oldPath, "utf8");
  const config = JSON.parse(content);
  const newFileName = await getUniqueFileName(
    newTemplateName,
    newVersion,
    oldFileName,
  );

  config.templateName = newTemplateName;
  config.version = newVersion;
  config.updatedAt = new Date().toISOString();

  await writeFileAsync(
    getTemplateFilePath(newFileName),
    JSON.stringify(config, null, 2),
    "utf8",
  );
  await unlinkAsync(oldPath);

  console.log(`Template renamed: ${oldFileName} → ${newFileName}`);
  return { success: true, oldFileName, newFileName };
};

/* ===================== LIST ===================== */

export const templateFileExists = (fileName) =>
  !!findExistingTemplateFilePath(fileName);

export const listTemplateFiles = async () => {
  try {
    const files = await readdirAsync(TEMPLATES_DIR);
    const jsonFiles = files.filter(
      (f) => f.endsWith(".json") && !f.includes("backup"),
    );

    return Promise.all(
      jsonFiles.map(async (fileName) => {
        const config = await readTemplateFile(fileName).catch(() => null);
        return {
          fileName,
          templateName: config?.templateName ?? fileName.replace(".json", ""),
          version: config?.version ?? "1.0",
          savedAt: config?.savedAt,
        };
      }),
    );
  } catch {
    return [];
  }
};

export { nextVersion, generateVersionedFileName, isSafeFileName };

export default {
  saveTemplateFile,
  saveNewTemplateVersion,
  archivePreviousVersion,
  readTemplateFile,
  readTemplateFileRaw,
  deleteTemplateFile,
  updateTemplateFile,
  backupTemplateFile,
  renameTemplateFile,
  templateFileExists,
  listTemplateFiles,
  nextVersion,
  generateVersionedFileName,
  isSafeFileName,
};
