import path from "path";
import fs from "fs";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);

/* ===================== TEMPLATE STORAGE CONFIG ===================== */

const uploadsDir = path.resolve("uploads");
const templatesDir = path.resolve(uploadsDir, "AuditTemplates");
const backupsDir = path.resolve(templatesDir, "backups");

// Create directories if they don't exist
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);

/* ===================== HELPER FUNCTIONS ===================== */

/**
 * Sanitize string for filesystem (remove special chars, replace spaces)
 * @param {string} str - Input string
 * @returns {string} - Sanitized string
 */
const sanitizeForFilename = (str) => {
  if (!str) return "";
  return str
    .trim()
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9_-]/g, "") // Remove special characters
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .substring(0, 100); // Limit length
};

/**
 * Generate template filename from name and version
 * Example: "Traceability Report" + "01" => "Traceability_Report_01.json"
 * @param {string} templateName - Template name
 * @param {string} version - Version number (e.g., "01", "1.0")
 * @returns {string} - Filename with .json extension
 */
const generateTemplateFileName = (templateName, version = "01") => {
  const sanitizedName = sanitizeForFilename(templateName);
  const sanitizedVersion = sanitizeForFilename(version);

  if (!sanitizedName) {
    throw new Error("Template name is required for filename generation");
  }

  return `${sanitizedName}_${sanitizedVersion}.json`;
};

/**
 * Get full file path for a template
 * @param {string} fileName - Template file name
 * @returns {string} - Full file path
 */
const getTemplateFilePath = (fileName) => {
  return path.join(templatesDir, fileName);
};

/**
 * Check if a filename already exists and generate unique name if needed
 * @param {string} templateName - Template name
 * @param {string} version - Version
 * @param {string} excludeFileName - Filename to exclude from check (for updates)
 * @returns {string} - Unique filename
 */
const getUniqueFileName = async (
  templateName,
  version,
  excludeFileName = null,
) => {
  let baseFileName = generateTemplateFileName(templateName, version);
  let fileName = baseFileName;
  let counter = 1;

  while (
    fs.existsSync(getTemplateFilePath(fileName)) &&
    fileName !== excludeFileName
  ) {
    const nameWithoutExt = baseFileName.replace(".json", "");
    fileName = `${nameWithoutExt}_${counter}.json`;
    counter++;

    // Safety limit
    if (counter > 100) {
      throw new Error("Too many duplicate template names");
    }
  }

  return fileName;
};

/* ===================== MAIN FUNCTIONS ===================== */

/**
 * Save template configuration to JSON file
 * @param {Object} options - Options object
 * @param {string} options.templateName - Template name
 * @param {string} options.version - Template version
 * @param {string} options.templateCode - Template code (for reference)
 * @param {Object} options.headerConfig - Header configuration
 * @param {Array} options.infoFields - Info fields
 * @param {Array} options.columns - Columns
 * @param {Array} options.defaultSections - Default sections
 * @param {string} options.existingFileName - Existing filename (for updates)
 * @returns {Promise<Object>} - Result with fileName
 */
export const saveTemplateFile = async ({
  templateName,
  version = "01",
  templateCode,
  headerConfig,
  infoFields,
  columns,
  defaultSections,
  existingFileName = null,
}) => {
  try {
    // Generate or use existing filename
    let fileName;

    if (
      existingFileName &&
      fs.existsSync(getTemplateFilePath(existingFileName))
    ) {
      // Use existing filename for updates
      fileName = existingFileName;
    } else {
      // Generate new unique filename
      fileName = await getUniqueFileName(templateName, version);
    }

    const filePath = getTemplateFilePath(fileName);

    // Template config to save
    const configToSave = {
      templateCode: templateCode || null,
      templateName,
      version,
      headerConfig: headerConfig || {},
      infoFields: infoFields || [],
      columns: columns || [],
      defaultSections: defaultSections || [],
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Write to file with pretty formatting
    await writeFileAsync(
      filePath,
      JSON.stringify(configToSave, null, 2),
      "utf8",
    );

    console.log(`✅ Template file saved: ${fileName}`);

    return {
      success: true,
      fileName,
      filePath,
    };
  } catch (error) {
    console.error("Error saving template file:", error);
    throw new Error(`Failed to save template file: ${error.message}`);
  }
};

/**
 * Read template configuration from JSON file
 * @param {string} fileName - Template file name
 * @returns {Promise<Object|null>} - Template configuration or null if not found
 */
export const readTemplateFile = async (fileName) => {
  try {
    if (!fileName) {
      console.warn("No filename provided to readTemplateFile");
      return null;
    }

    const filePath = getTemplateFilePath(fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`Template file not found: ${fileName}`);
      return null;
    }

    const fileContent = await readFileAsync(filePath, "utf8");
    const config = JSON.parse(fileContent);

    return config;
  } catch (error) {
    console.error("Error reading template file:", error);
    throw new Error(`Failed to read template file: ${error.message}`);
  }
};

/**
 * Delete template JSON file
 * @param {string} fileName - Template file name
 * @returns {Promise<boolean>} - True if deleted successfully
 */
export const deleteTemplateFile = async (fileName) => {
  try {
    if (!fileName) {
      console.warn("No filename provided to deleteTemplateFile");
      return false;
    }

    const filePath = getTemplateFilePath(fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`Template file not found for deletion: ${fileName}`);
      return false;
    }

    await unlinkAsync(filePath);
    console.log(`✅ Template file deleted: ${fileName}`);

    return true;
  } catch (error) {
    console.error("Error deleting template file:", error);
    throw new Error(`Failed to delete template file: ${error.message}`);
  }
};

/**
 * Update template configuration file (with rename support)
 * @param {Object} options - Options object
 * @param {string} options.oldFileName - Current file name
 * @param {string} options.templateName - New template name
 * @param {string} options.version - New version
 * @param {string} options.templateCode - Template code
 * @param {Object} options.headerConfig - Header config
 * @param {Array} options.infoFields - Info fields
 * @param {Array} options.columns - Columns
 * @param {Array} options.defaultSections - Default sections
 * @returns {Promise<Object>} - Result with fileName
 */
export const updateTemplateFile = async ({
  oldFileName,
  templateName,
  version,
  templateCode,
  headerConfig,
  infoFields,
  columns,
  defaultSections,
}) => {
  try {
    // Generate new filename based on new name/version
    const newFileName = generateTemplateFileName(templateName, version);

    // Check if name changed
    const nameChanged = oldFileName && oldFileName !== newFileName;

    // If name changed, check if new filename already exists
    if (nameChanged) {
      const newFilePath = getTemplateFilePath(newFileName);
      if (fs.existsSync(newFilePath)) {
        // Add suffix to make unique
        const uniqueFileName = await getUniqueFileName(
          templateName,
          version,
          oldFileName,
        );

        // Delete old file
        if (oldFileName) {
          await deleteTemplateFile(oldFileName);
        }

        // Save with new unique filename
        return await saveTemplateFile({
          templateName,
          version,
          templateCode,
          headerConfig,
          infoFields,
          columns,
          defaultSections,
          existingFileName: uniqueFileName,
        });
      }
    }

    // Delete old file if name changed
    if (nameChanged && oldFileName) {
      await deleteTemplateFile(oldFileName);
    }

    // Save with new or same filename
    return await saveTemplateFile({
      templateName,
      version,
      templateCode,
      headerConfig,
      infoFields,
      columns,
      defaultSections,
      existingFileName: nameChanged ? null : oldFileName,
    });
  } catch (error) {
    console.error("Error updating template file:", error);
    throw new Error(`Failed to update template file: ${error.message}`);
  }
};

/**
 * Backup template file
 * @param {string} fileName - Template file name
 * @returns {Promise<string>} - Backup file name
 */
export const backupTemplateFile = async (fileName) => {
  try {
    if (!fileName) {
      throw new Error("Filename is required for backup");
    }

    const filePath = getTemplateFilePath(fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Template file not found: ${fileName}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const nameWithoutExt = fileName.replace(".json", "");
    const backupFileName = `${nameWithoutExt}_backup_${timestamp}.json`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    const content = await readFileAsync(filePath, "utf8");
    await writeFileAsync(backupFilePath, content, "utf8");

    console.log(`✅ Template backup created: ${backupFileName}`);
    return backupFileName;
  } catch (error) {
    console.error("Error backing up template file:", error);
    throw new Error(`Failed to backup template file: ${error.message}`);
  }
};

/**
 * Check if template file exists
 * @param {string} fileName - Template file name
 * @returns {boolean} - True if file exists
 */
export const templateFileExists = (fileName) => {
  if (!fileName) return false;
  const filePath = getTemplateFilePath(fileName);
  return fs.existsSync(filePath);
};

/**
 * Get all template files in directory
 * @returns {Promise<Array>} - Array of template file info
 */
export const listTemplateFiles = async () => {
  try {
    const files = await readdirAsync(templatesDir);
    const jsonFiles = files.filter(
      (file) => file.endsWith(".json") && !file.includes("backup"),
    );

    const fileInfos = await Promise.all(
      jsonFiles.map(async (fileName) => {
        try {
          const config = await readTemplateFile(fileName);
          return {
            fileName,
            templateName: config?.templateName || fileName.replace(".json", ""),
            version: config?.version || "1.0",
            savedAt: config?.savedAt,
          };
        } catch {
          return { fileName, templateName: fileName.replace(".json", "") };
        }
      }),
    );

    return fileInfos;
  } catch (error) {
    console.error("Error listing template files:", error);
    return [];
  }
};

/**
 * Rename template file
 * @param {string} oldFileName - Current file name
 * @param {string} newTemplateName - New template name
 * @param {string} newVersion - New version
 * @returns {Promise<Object>} - Result with new fileName
 */
export const renameTemplateFile = async (
  oldFileName,
  newTemplateName,
  newVersion,
) => {
  try {
    const oldFilePath = getTemplateFilePath(oldFileName);

    if (!fs.existsSync(oldFilePath)) {
      throw new Error(`Template file not found: ${oldFileName}`);
    }

    // Read existing content
    const content = await readFileAsync(oldFilePath, "utf8");
    const config = JSON.parse(content);

    // Generate new filename
    const newFileName = await getUniqueFileName(
      newTemplateName,
      newVersion,
      oldFileName,
    );
    const newFilePath = getTemplateFilePath(newFileName);

    // Update config
    config.templateName = newTemplateName;
    config.version = newVersion;
    config.updatedAt = new Date().toISOString();

    // Write to new file
    await writeFileAsync(newFilePath, JSON.stringify(config, null, 2), "utf8");

    // Delete old file
    await unlinkAsync(oldFilePath);

    console.log(`✅ Template file renamed: ${oldFileName} -> ${newFileName}`);

    return {
      success: true,
      oldFileName,
      newFileName,
    };
  } catch (error) {
    console.error("Error renaming template file:", error);
    throw new Error(`Failed to rename template file: ${error.message}`);
  }
};

export default {
  saveTemplateFile,
  readTemplateFile,
  deleteTemplateFile,
  updateTemplateFile,
  backupTemplateFile,
  templateFileExists,
  listTemplateFiles,
  renameTemplateFile,
};
