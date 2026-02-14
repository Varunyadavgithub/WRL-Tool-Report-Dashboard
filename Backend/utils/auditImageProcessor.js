import { saveImageFromBase64, deleteMultipleImages } from "./Imagestorage.js";

/**
 * Process images in audit sections - extract base64, save to disk, replace with filename
 * @param {Array} sections - Audit sections array
 * @param {string} auditCode - Audit code for file naming
 * @returns {Promise<Object>} - Processed sections and image metadata
 */
export const processAuditImages = async (sections, auditCode) => {
  if (!sections || !Array.isArray(sections)) {
    return { sections: [], savedImages: [] };
  }

  const savedImages = [];
  const processedSections = [];

  for (const section of sections) {
    const processedSection = { ...section };

    // Handle NEW structure: section.stages[].checkPoints[]
    if (section.stages && Array.isArray(section.stages)) {
      processedSection.stages = [];

      for (const stage of section.stages) {
        const processedStage = { ...stage };

        if (stage.checkPoints && Array.isArray(stage.checkPoints)) {
          processedStage.checkPoints = [];

          for (const checkpoint of stage.checkPoints) {
            const processedCheckpoint = { ...checkpoint };

            // Process all fields in checkpoint that might contain images
            for (const [key, value] of Object.entries(checkpoint)) {
              if (value && typeof value === "object" && value.data) {
                // This looks like an image object with base64 data
                try {
                  const imageResult = await saveImageFromBase64({
                    base64Data: value.data,
                    fileName: value.name || `checkpoint_${key}.jpg`,
                    auditCode,
                  });

                  // Replace image object with just the filename
                  processedCheckpoint[key] = imageResult.fileName;

                  savedImages.push({
                    field: key,
                    fileName: imageResult.fileName,
                    originalName: value.name,
                    size: imageResult.size,
                  });
                } catch (error) {
                  console.error(`Error saving image for ${key}:`, error);
                  // Keep original data or set to null
                  processedCheckpoint[key] = null;
                }
              }
            }

            processedStage.checkPoints.push(processedCheckpoint);
          }
        }

        processedSection.stages.push(processedStage);
      }
    }
    // Handle OLD structure: section.checkPoints[] (flat)
    else if (section.checkPoints && Array.isArray(section.checkPoints)) {
      processedSection.checkPoints = [];

      for (const checkpoint of section.checkPoints) {
        const processedCheckpoint = { ...checkpoint };

        // Process all fields in checkpoint that might contain images
        for (const [key, value] of Object.entries(checkpoint)) {
          if (value && typeof value === "object" && value.data) {
            // This looks like an image object with base64 data
            try {
              const imageResult = await saveImageFromBase64({
                base64Data: value.data,
                fileName: value.name || `checkpoint_${key}.jpg`,
                auditCode,
              });

              // Replace image object with just the filename
              processedCheckpoint[key] = imageResult.fileName;

              savedImages.push({
                field: key,
                fileName: imageResult.fileName,
                originalName: value.name,
                size: imageResult.size,
              });
            } catch (error) {
              console.error(`Error saving image for ${key}:`, error);
              // Keep original data or set to null
              processedCheckpoint[key] = null;
            }
          }
        }

        processedSection.checkPoints.push(processedCheckpoint);
      }
    }

    processedSections.push(processedSection);
  }

  return {
    sections: processedSections,
    savedImages,
  };
};

/**
 * Extract all image filenames from audit sections
 * @param {Array} sections - Audit sections array
 * @returns {Array<string>} - Array of image filenames
 */
export const extractImageFilenames = (sections) => {
  if (!sections || !Array.isArray(sections)) {
    return [];
  }

  const imageFilenames = [];

  for (const section of sections) {
    // Handle NEW structure: section.stages[].checkPoints[]
    if (section.stages && Array.isArray(section.stages)) {
      for (const stage of section.stages) {
        if (stage.checkPoints && Array.isArray(stage.checkPoints)) {
          for (const checkpoint of stage.checkPoints) {
            // Check all fields for image filenames (strings that look like image files)
            for (const value of Object.values(checkpoint)) {
              if (
                typeof value === "string" &&
                /\.(jpg|jpeg|png|gif|webp)$/i.test(value)
              ) {
                imageFilenames.push(value);
              }
            }
          }
        }
      }
    }
    // Handle OLD structure: section.checkPoints[]
    else if (section.checkPoints && Array.isArray(section.checkPoints)) {
      for (const checkpoint of section.checkPoints) {
        // Check all fields for image filenames
        for (const value of Object.values(checkpoint)) {
          if (
            typeof value === "string" &&
            /\.(jpg|jpeg|png|gif|webp)$/i.test(value)
          ) {
            imageFilenames.push(value);
          }
        }
      }
    }
  }

  return imageFilenames;
};

/**
 * Delete images associated with an audit
 * @param {Array} sections - Audit sections array
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteAuditImages = async (sections) => {
  const imageFilenames = extractImageFilenames(sections);

  if (imageFilenames.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  console.log(`Deleting ${imageFilenames.length} images from audit`);
  return await deleteMultipleImages(imageFilenames);
};

/**
 * Compare old and new sections and delete removed images
 * @param {Array} oldSections - Previous audit sections
 * @param {Array} newSections - Updated audit sections
 * @returns {Promise<Object>} - Deletion result
 */
export const cleanupRemovedImages = async (oldSections, newSections) => {
  const oldImages = extractImageFilenames(oldSections);
  const newImages = extractImageFilenames(newSections);

  // Find images that were in old but not in new (removed images)
  const removedImages = oldImages.filter((img) => !newImages.includes(img));

  if (removedImages.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  console.log(`Cleaning up ${removedImages.length} removed images`);
  return await deleteMultipleImages(removedImages);
};
