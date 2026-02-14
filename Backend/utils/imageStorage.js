import path from "path";
import fs from "fs";
import { promisify } from "util";
import crypto from "crypto";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

/* ===================== IMAGE STORAGE CONFIG ===================== */

const uploadsDir = path.resolve("uploads");
const auditImagesDir = path.resolve(uploadsDir, "AuditImages");

// Create directories if they don't exist
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(auditImagesDir)) fs.mkdirSync(auditImagesDir);

/* ===================== HELPER FUNCTIONS ===================== */

/**
 * Generate unique filename for image
 * @param {string} originalName - Original filename
 * @param {string} auditCode - Audit code for organization
 * @returns {string} - Unique filename
 */
export const generateImageFileName = (originalName, auditCode = "") => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalName).toLowerCase();

  // Sanitize audit code
  const sanitizedAuditCode = auditCode
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .substring(0, 20);

  if (sanitizedAuditCode) {
    return `${sanitizedAuditCode}_${timestamp}_${randomString}${ext}`;
  }

  return `IMG_${timestamp}_${randomString}${ext}`;
};

/**
 * Get full file path for an image
 * @param {string} fileName - Image file name
 * @returns {string} - Full file path
 */
export const getImageFilePath = (fileName) => {
  return path.join(auditImagesDir, fileName);
};

/**
 * Validate image file type
 * @param {string} mimetype - File mimetype
 * @returns {boolean} - True if valid image type
 */
export const isValidImageType = (mimetype) => {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(mimetype);
};

/**
 * Validate image file size (max 5MB)
 * @param {number} size - File size in bytes
 * @returns {boolean} - True if within size limit
 */
export const isValidImageSize = (size) => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  return size <= maxSize;
};

/* ===================== MAIN FUNCTIONS ===================== */

/**
 * Save image from base64 data
 * @param {Object} options - Options object
 * @param {string} options.base64Data - Base64 encoded image data (with data URI prefix)
 * @param {string} options.fileName - Original filename
 * @param {string} options.auditCode - Audit code for organization
 * @returns {Promise<Object>} - Result with saved filename and metadata
 */
export const saveImageFromBase64 = async ({
  base64Data,
  fileName,
  auditCode = "",
}) => {
  try {
    if (!base64Data || !fileName) {
      throw new Error("Base64 data and filename are required");
    }

    // Extract base64 content (remove data URI prefix if present)
    // Format: data:image/png;base64,iVBORw0KGgoAAAANS...
    let base64Content = base64Data;
    let mimeType = "image/jpeg"; // default

    if (base64Data.includes("data:")) {
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Content = matches[2];
      } else {
        // Try without mime type
        base64Content = base64Data.split(",")[1] || base64Data;
      }
    }

    // Validate mime type
    if (!isValidImageType(mimeType)) {
      throw new Error(
        `Invalid image type: ${mimeType}. Allowed types: JPEG, PNG, GIF, WebP`,
      );
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Content, "base64");

    // Validate size
    if (!isValidImageSize(imageBuffer.length)) {
      throw new Error(
        `Image size exceeds 5MB limit. Size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    // Generate unique filename
    const uniqueFileName = generateImageFileName(fileName, auditCode);
    const filePath = getImageFilePath(uniqueFileName);

    // Save to disk
    await writeFileAsync(filePath, imageBuffer);

    console.log(
      `✅ Image saved: ${uniqueFileName} (${(imageBuffer.length / 1024).toFixed(2)}KB)`,
    );

    return {
      success: true,
      fileName: uniqueFileName,
      filePath,
      size: imageBuffer.length,
      mimeType,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error saving image from base64:", error);
    throw new Error(`Failed to save image: ${error.message}`);
  }
};

/**
 * Save uploaded image file (from multer)
 * @param {Object} file - Multer file object
 * @param {string} auditCode - Audit code for organization
 * @returns {Promise<Object>} - Result with saved filename and metadata
 */
export const saveUploadedImage = async (file, auditCode = "") => {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    // Validate file type
    if (!isValidImageType(file.mimetype)) {
      throw new Error(
        `Invalid image type: ${file.mimetype}. Allowed types: JPEG, PNG, GIF, WebP`,
      );
    }

    // Validate file size
    if (!isValidImageSize(file.size)) {
      throw new Error(
        `Image size exceeds 5MB limit. Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    // Generate unique filename
    const uniqueFileName = generateImageFileName(file.originalname, auditCode);
    const filePath = getImageFilePath(uniqueFileName);

    // Move/copy file to destination
    await writeFileAsync(filePath, file.buffer);

    console.log(
      `✅ Image uploaded: ${uniqueFileName} (${(file.size / 1024).toFixed(2)}KB)`,
    );

    return {
      success: true,
      fileName: uniqueFileName,
      filePath,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error saving uploaded image:", error);
    throw new Error(`Failed to save uploaded image: ${error.message}`);
  }
};

/**
 * Delete image file
 * @param {string} fileName - Image file name
 * @returns {Promise<boolean>} - True if deleted successfully
 */
export const deleteImage = async (fileName) => {
  try {
    if (!fileName) {
      console.warn("No filename provided to deleteImage");
      return false;
    }

    const filePath = getImageFilePath(fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`Image file not found for deletion: ${fileName}`);
      return false;
    }

    await unlinkAsync(filePath);
    console.log(`✅ Image deleted: ${fileName}`);

    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Delete multiple images
 * @param {Array<string>} fileNames - Array of image file names
 * @returns {Promise<Object>} - Result with deleted count
 */
export const deleteMultipleImages = async (fileNames) => {
  try {
    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    let deletedCount = 0;
    const errors = [];

    for (const fileName of fileNames) {
      try {
        const deleted = await deleteImage(fileName);
        if (deleted) deletedCount++;
      } catch (error) {
        errors.push({ fileName, error: error.message });
      }
    }

    console.log(`✅ Deleted ${deletedCount} of ${fileNames.length} images`);

    return {
      success: true,
      deletedCount,
      totalCount: fileNames.length,
      errors: errors.length > 0 ? errors : null,
    };
  } catch (error) {
    console.error("Error deleting multiple images:", error);
    throw new Error(`Failed to delete multiple images: ${error.message}`);
  }
};

/**
 * Check if image file exists
 * @param {string} fileName - Image file name
 * @returns {boolean} - True if file exists
 */
export const imageExists = (fileName) => {
  if (!fileName) return false;
  const filePath = getImageFilePath(fileName);
  return fs.existsSync(filePath);
};

/**
 * Get image file info
 * @param {string} fileName - Image file name
 * @returns {Promise<Object|null>} - Image info or null if not found
 */
export const getImageInfo = async (fileName) => {
  try {
    if (!fileName) return null;

    const filePath = getImageFilePath(fileName);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = await statAsync(filePath);

    return {
      fileName,
      filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  } catch (error) {
    console.error("Error getting image info:", error);
    return null;
  }
};

/**
 * List all images in directory
 * @returns {Promise<Array>} - Array of image file info
 */
export const listImages = async () => {
  try {
    const files = await readdirAsync(auditImagesDir);
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
    });

    const fileInfos = await Promise.all(
      imageFiles.map(async (fileName) => {
        const info = await getImageInfo(fileName);
        return info;
      }),
    );

    return fileInfos.filter((info) => info !== null);
  } catch (error) {
    console.error("Error listing images:", error);
    return [];
  }
};

/**
 * Get total size of all images
 * @returns {Promise<number>} - Total size in bytes
 */
export const getTotalImageSize = async () => {
  try {
    const images = await listImages();
    const totalSize = images.reduce((sum, img) => sum + (img.size || 0), 0);
    return totalSize;
  } catch (error) {
    console.error("Error getting total image size:", error);
    return 0;
  }
};

/**
 * Clean up orphaned images (images not referenced in database)
 * This is a utility function for maintenance
 * @param {Array<string>} referencedFileNames - Array of filenames currently referenced in DB
 * @returns {Promise<Object>} - Cleanup result
 */
export const cleanupOrphanedImages = async (referencedFileNames = []) => {
  try {
    const allImages = await listImages();
    const orphanedImages = allImages.filter(
      (img) => !referencedFileNames.includes(img.fileName),
    );

    if (orphanedImages.length === 0) {
      console.log("No orphaned images found");
      return { success: true, deletedCount: 0, orphanedCount: 0 };
    }

    const fileNamesToDelete = orphanedImages.map((img) => img.fileName);
    const result = await deleteMultipleImages(fileNamesToDelete);

    console.log(`✅ Cleaned up ${result.deletedCount} orphaned images`);

    return {
      success: true,
      deletedCount: result.deletedCount,
      orphanedCount: orphanedImages.length,
    };
  } catch (error) {
    console.error("Error cleaning up orphaned images:", error);
    throw new Error(`Failed to cleanup orphaned images: ${error.message}`);
  }
};
