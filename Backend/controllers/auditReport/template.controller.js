import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateTemplateCode } from "../../utils/generateCode.js";
import {
  saveTemplateFile,
  readTemplateFile,
  deleteTemplateFile,
  updateTemplateFile,
  backupTemplateFile,
} from "../../utils/storage/templateStorage.js";

// ── History helper ────────────────────────────────────────────────────────────
const logTemplateHistory = async (pool, { templateId, action, actionBy, comments, previousStatus, newStatus, fieldChanges }) => {
  try {
    await pool.request()
      .input("templateId",     sql.Int,          templateId)
      .input("action",         sql.NVarChar,     action)
      .input("actionBy",       sql.NVarChar,     actionBy  || "SYSTEM")
      .input("comments",       sql.NVarChar,     comments  || null)
      .input("previousStatus", sql.NVarChar,     previousStatus || null)
      .input("newStatus",      sql.NVarChar,     newStatus || null)
      .input("fieldChanges",   sql.NVarChar,     fieldChanges ? JSON.stringify(fieldChanges) : null)
      .query(`
        INSERT INTO AuditTemplateHistory
          (TemplateId, Action, ActionBy, ActionAt, Comments, PreviousStatus, NewStatus, FieldChanges)
        VALUES
          (@templateId, @action, @actionBy, GETDATE(), @comments, @previousStatus, @newStatus, @fieldChanges)
      `);
  } catch (err) {
    console.warn("Failed to log template history:", err.message);
  }
};

// Get all templates
export const getAllTemplates = tryCatch(async (req, res) => {
  const { category, isActive, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const request = pool.request();

  let whereConditions = ["IsDeleted=0"];

  if (category) {
    request.input("category", sql.VarChar, category);
    whereConditions.push("Category = @category");
  }

  if (isActive !== undefined) {
    request.input("isActive", sql.Bit, isActive === "true" ? 1 : 0);
    whereConditions.push("IsActive=@isActive");
  }

  if (search) {
    request.input("search", sql.NVarChar, `%${search}%`);
    whereConditions.push("(Name LIKE @search OR Description LIKE @search)");
  }

  request.input("offset", sql.Int, offset);
  request.input("limit", sql.Int, parseInt(limit));

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    WITH TemplateData AS (
      SELECT
        Id,
        TemplateCode,
        TemplateFileName,
        Name,
        Description,
        Category,
        Version,
        IsActive,
        Models,
        ApprovalStatus,
        ApprovedBy,
        ApprovedAt,
        RejectionReason,
        CreatedBy,
        CreatedAt,
        UpdatedBy,
        UpdatedAt,
        ROW_NUMBER() OVER (ORDER BY CreatedAt DESC) AS RowNum
      FROM AuditTemplates
      ${whereClause}
    )
    SELECT
      (SELECT COUNT(*) FROM TemplateData) AS TotalCount,
      *
    FROM TemplateData
    WHERE RowNum > @offset AND RowNum <= (@offset + @limit);
  `;

  const result = await request.query(query);
  await pool.close();

  // Load JSON config from files for each template
  const templates = await Promise.all(
    result.recordset.map(async (template) => {
      let config = null;

      if (template.TemplateFileName) {
        try {
          config = await readTemplateFile(template.TemplateFileName);
        } catch (err) {
          console.warn(
            `Could not load config for template ${template.Name}:`,
            err.message,
          );
        }
      }

      return {
        ...template,
        HeaderConfig: config?.headerConfig || null,
        InfoFields: config?.infoFields || [],
        Columns: config?.columns || [],
        DefaultSections: config?.defaultSections || [],
      };
    }),
  );

  res.status(200).json({
    success: true,
    message: "Templates retrieved successfully.",
    data: templates,
    totalCount:
      result.recordset.length > 0 ? result.recordset[0].TotalCount : 0,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// Get template by ID
export const getTemplateById = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const result = await pool.request().input("id", sql.Int, id).query(`
    SELECT
      Id,
      TemplateCode,
      TemplateFileName,
      Name,
      Description,
      Category,
      Version,
      IsActive,
      Models,
      ApprovalStatus,
      ApprovedBy,
      ApprovedAt,
      RejectionReason,
      CreatedBy,
      CreatedAt,
      UpdatedBy,
      UpdatedAt
    FROM AuditTemplates
    WHERE Id = @id AND IsDeleted = 0
  `);

  await pool.close();

  if (result.recordset.length === 0) {
    throw new AppError("Template not found", 404);
  }

  const template = result.recordset[0];

  // Load JSON config from file
  let config = null;
  if (template.TemplateFileName) {
    try {
      config = await readTemplateFile(template.TemplateFileName);
    } catch (err) {
      console.warn(
        `Could not load config for template ${template.Name}:`,
        err.message,
      );
    }
  }

  res.status(200).json({
    success: true,
    message: "Template retrieved successfully",
    data: {
      ...template,
      HeaderConfig: config?.headerConfig || null,
      InfoFields: config?.infoFields || [],
      Columns: config?.columns || [],
      DefaultSections: config?.defaultSections || [],
    },
  });
});

// Create template
export const createTemplate = tryCatch(async (req, res) => {
  const {
    name,
    description,
    category,
    version = "01",
    isActive,
    approvalStatus,
    models,
    headerConfig,
    infoFields,
    columns,
    defaultSections,
  } = req.body;

  if (!name) {
    throw new AppError("Template name is required", 400);
  }

  const templateCode = await generateTemplateCode();
  // Store the creator's display name; fall back to usercode then SYSTEM
  const createdBy = req.user?.name || req.user?.usercode || "SYSTEM";

  // Save JSON config to file first
  const fileResult = await saveTemplateFile({
    templateName: name,
    version: version || "01",
    templateCode,
    headerConfig: headerConfig || {},
    infoFields: infoFields || [],
    columns: columns || [],
    defaultSections: defaultSections || [],
  });

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Insert metadata into database with file reference
  const result = await pool
    .request()
    .input("templateCode", sql.VarChar, templateCode)
    .input("templateFileName", sql.VarChar, fileResult.fileName)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description || null)
    .input("category", sql.VarChar, category || null)
    .input("version", sql.VarChar, version || "01")
    .input("isActive", sql.Bit, isActive !== false ? 1 : 0)
    .input("approvalStatus", sql.VarChar, approvalStatus || "draft")
    .input("models", sql.NVarChar, models ? JSON.stringify(models) : null)
    .input("createdBy", sql.VarChar, createdBy).query(`
      INSERT INTO AuditTemplates (
        TemplateCode, TemplateFileName, Name, Description, Category, Version, IsActive,
        Models, ApprovalStatus, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @templateCode, @templateFileName, @name, @description, @category, @version, @isActive,
        @models, @approvalStatus, @createdBy, GETDATE(), @createdBy, GETDATE()
      );
    `);

  const template = result.recordset[0];
  await logTemplateHistory(pool, {
    templateId: template.Id,
    action: "created",
    actionBy: createdBy,
    newStatus: approvalStatus || "draft",
    fieldChanges: [{ field: "Name", from: null, to: name }],
  });

  await pool.close();

  res.status(201).json({
    success: true,
    message: "Template created successfully",
    data: {
      ...template,
      HeaderConfig: headerConfig || {},
      InfoFields: infoFields || [],
      Columns: columns || [],
      DefaultSections: defaultSections || [],
    },
  });
});

// Update template
export const updateTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    category,
    version,
    isActive,
    models,
    headerConfig,
    infoFields,
    columns,
    defaultSections,
    approvalStatus,
    approvedBy,
    approvedAt,
    rejectionReason,
  } = req.body;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const updatedBy = req.user?.name || req.user?.usercode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Get current template
  const checkResult = await pool.request().input("id", sql.Int, id).query(`
    SELECT Id, TemplateCode, TemplateFileName, Name, Version 
    FROM AuditTemplates 
    WHERE Id = @id AND IsDeleted = 0
  `);

  if (checkResult.recordset.length === 0) {
    await pool.close();
    throw new AppError("Template not found", 404);
  }

  const currentTemplate = checkResult.recordset[0];
  const oldFileName = currentTemplate.TemplateFileName;

  // Only rewrite the JSON file when actual template content is included in the request.
  // Status-only updates (approve/reject/submit) must not overwrite sections/columns.
  const hasFileContent =
    headerConfig !== undefined ||
    infoFields !== undefined ||
    columns !== undefined ||
    defaultSections !== undefined;

  // Read old sections BEFORE backup/overwrite so we can diff them
  let oldSections = [];
  if (hasFileContent && oldFileName) {
    try {
      const oldConfig = await readTemplateFile(oldFileName);
      oldSections = oldConfig?.defaultSections || [];
    } catch { /* file may not exist yet */ }
  }

  let resolvedFileName = oldFileName;

  if (hasFileContent) {
    if (oldFileName) {
      try {
        await backupTemplateFile(oldFileName);
      } catch (err) {
        console.warn("Could not backup template file:", err.message);
      }
    }
    const fileResult = await updateTemplateFile({
      oldFileName,
      templateName: name || currentTemplate.Name,
      version: version || currentTemplate.Version || "01",
      templateCode: currentTemplate.TemplateCode,
      headerConfig: headerConfig || {},
      infoFields: infoFields || [],
      columns: columns || [],
      defaultSections: defaultSections || [],
    });
    resolvedFileName = fileResult.fileName;
  }

  // Update metadata in database
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("templateFileName", sql.VarChar, resolvedFileName)
    .input("name", sql.NVarChar, name || currentTemplate.Name)
    .input("description", sql.NVarChar, description || null)
    .input("category", sql.VarChar, category || null)
    .input("version", sql.VarChar, version || "01")
    .input("isActive", sql.Bit, isActive !== false ? 1 : 0)
    .input("approvalStatus", sql.VarChar, approvalStatus || currentTemplate.approvalStatus || null)
    .input("approvedBy", sql.VarChar, approvedBy || null)
    .input("approvedAt", sql.DateTime, approvedAt ? new Date(approvedAt) : null)
    .input("rejectionReason", sql.NVarChar, rejectionReason || null)
    .input("models", sql.NVarChar, models !== undefined ? JSON.stringify(models) : null)
    .input("updatedBy", sql.VarChar, updatedBy).query(`
      UPDATE AuditTemplates
      SET
        TemplateFileName = @templateFileName,
        Name = @name,
        Description = @description,
        Category = @category,
        Version = @version,
        IsActive = @isActive,
        ${models !== undefined ? "Models = @models," : ""}
        ApprovalStatus = @approvalStatus,
        ApprovedBy = @approvedBy,
        ApprovedAt = @approvedAt,
        RejectionReason = @rejectionReason,
        UpdatedBy = @updatedBy,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND IsDeleted = 0;
    `);

  const template = result.recordset[0];

  // Build field-change log
  const fieldChanges = [];
  if (name && name !== currentTemplate.Name)
    fieldChanges.push({ field: "Name", from: currentTemplate.Name, to: name });
  if (description !== undefined && description !== currentTemplate.Description)
    fieldChanges.push({ field: "Description", from: currentTemplate.Description, to: description });
  if (category !== undefined && category !== currentTemplate.Category)
    fieldChanges.push({ field: "Category", from: currentTemplate.Category, to: category });
  if (approvalStatus && approvalStatus !== currentTemplate.ApprovalStatus)
    fieldChanges.push({ field: "Status", from: currentTemplate.ApprovalStatus, to: approvalStatus });

  // ── Section / checkpoint diff ────────────────────────────────────────────
  if (hasFileContent && defaultSections !== undefined) {
    const countCPs = (sections) =>
      (sections || []).reduce((total, s) => {
        if (s.stages) return total + s.stages.reduce((t, st) => t + (st.checkPoints?.length || 0), 0);
        return total + (s.checkPoints?.length || 0);
      }, 0);

    const oldTotal = countCPs(oldSections);
    const newTotal = countCPs(defaultSections);

    // Total checkpoint change
    if (oldTotal !== newTotal) {
      const diff = newTotal - oldTotal;
      fieldChanges.push({
        field: "Total Checkpoints",
        from: String(oldTotal),
        to:   String(newTotal),
        note: diff > 0 ? `+${diff} added` : `${diff} removed`,
      });
    }

    // Section-level additions / removals
    const oldSecNames = oldSections.map((s) => s.sectionName || "").filter(Boolean);
    const newSecNames = (defaultSections || []).map((s) => s.sectionName || "").filter(Boolean);
    const addedSecs   = newSecNames.filter((n) => !oldSecNames.includes(n));
    const removedSecs = oldSecNames.filter((n) => !newSecNames.includes(n));

    if (addedSecs.length)
      fieldChanges.push({ field: "Sections Added",   from: null,                    to: addedSecs.join(", ") });
    if (removedSecs.length)
      fieldChanges.push({ field: "Sections Removed", from: removedSecs.join(", "), to: null });

    // Per-section checkpoint changes
    oldSections.forEach((oldSec) => {
      const newSec = (defaultSections || []).find((s) => s.sectionName === oldSec.sectionName);
      if (!newSec) return; // already captured in Sections Removed

      const countSecCPs = (sec) => {
        if (sec.stages) return sec.stages.reduce((t, st) => t + (st.checkPoints?.length || 0), 0);
        return sec.checkPoints?.length || 0;
      };

      const oldN = countSecCPs(oldSec);
      const newN = countSecCPs(newSec);
      if (oldN !== newN) {
        const diff = newN - oldN;
        fieldChanges.push({
          field: `Section — ${oldSec.sectionName || "Unnamed"}`,
          from: String(oldN) + " checkpoints",
          to:   String(newN) + " checkpoints",
          note: diff > 0 ? `+${diff} added` : `${diff} removed`,
        });
      }

      // Per-stage checkpoint changes within the section
      (oldSec.stages || []).forEach((oldStage) => {
        const newStage = (newSec.stages || []).find((st) => st.stageName === oldStage.stageName);
        if (!newStage) return;
        const oldSt = oldStage.checkPoints?.length || 0;
        const newSt = newStage.checkPoints?.length || 0;
        if (oldSt !== newSt) {
          const diff = newSt - oldSt;
          fieldChanges.push({
            field: `Stage — ${oldStage.stageName || "Unnamed"}`,
            from: String(oldSt) + " checkpoints",
            to:   String(newSt) + " checkpoints",
            note: diff > 0 ? `+${diff} added` : `${diff} removed`,
          });
        }
      });
    });
  }

  const historyAction =
    approvalStatus === "pending_approval" ? "submitted_for_approval"
    : approvalStatus === "approved"       ? "approved"
    : approvalStatus === "rejected"       ? "rejected"
    : hasFileContent                      ? "updated"
    : "status_changed";

  await logTemplateHistory(pool, {
    templateId: parseInt(id),
    action: historyAction,
    actionBy: updatedBy,
    comments: rejectionReason || null,
    previousStatus: currentTemplate.ApprovalStatus,
    newStatus: approvalStatus || currentTemplate.ApprovalStatus,
    fieldChanges: fieldChanges.length > 0 ? fieldChanges : null,
  });

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Template updated successfully",
    data: {
      ...template,
      // Only echo back file fields if they were part of this request
      ...(hasFileContent && {
        HeaderConfig: headerConfig || {},
        InfoFields: infoFields || [],
        Columns: columns || [],
        DefaultSections: defaultSections || [],
      }),
    },
  });
});

// Delete template (soft delete)
export const deleteTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const updatedBy = req.user?.name || req.user?.usercode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Check if template exists
  const checkResult = await pool.request().input("id", sql.Int, id).query(`
    SELECT Id, TemplateCode, TemplateFileName 
    FROM AuditTemplates 
    WHERE Id = @id AND IsDeleted = 0
  `);

  if (checkResult.recordset.length === 0) {
    await pool.close();
    throw new AppError("Template not found", 404);
  }

  const templateFileName = checkResult.recordset[0].TemplateFileName;

  // Check if template is used in any audits
  const auditCheck = await pool
    .request()
    .input("templateId", sql.Int, id)
    .query(
      "SELECT COUNT(*) AS Count FROM Audits WHERE TemplateId = @templateId AND IsDeleted = 0",
    );

  if (auditCheck.recordset[0].Count > 0) {
    await pool.close();
    throw new AppError(
      "Cannot delete template. It is used in existing audits.",
      400,
    );
  }

  // Soft delete in database
  await pool
    .request()
    .input("id", sql.Int, id)
    .input("updatedBy", sql.VarChar, updatedBy).query(`
      UPDATE AuditTemplates
      SET IsDeleted = 1, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
      WHERE Id = @id;
    `);

  await pool.close();

  // Backup and delete template file
  if (templateFileName) {
    try {
      await backupTemplateFile(templateFileName);
      await deleteTemplateFile(templateFileName);
    } catch (err) {
      console.warn("Could not delete template file:", err.message);
    }
  }

  res.status(200).json({
    success: true,
    message: "Template deleted successfully",
  });
});

// Duplicate template
export const duplicateTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Get original template metadata
  const originalResult = await pool.request().input("id", sql.Int, id).query(`
    SELECT * FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0
  `);

  if (originalResult.recordset.length === 0) {
    await pool.close();
    throw new AppError("Template not found", 404);
  }

  const original = originalResult.recordset[0];
  const newTemplateCode = await generateTemplateCode();
  // Auth middleware is currently disabled — accept createdBy from request body as fallback
  const createdBy = req.user?.name || req.user?.usercode || req.body?.createdBy || "SYSTEM";
  const newName = `${original.Name} (Copy)`;

  // Load original template config from file
  let originalConfig = null;
  if (original.TemplateFileName) {
    try {
      originalConfig = await readTemplateFile(original.TemplateFileName);
    } catch (err) {
      console.warn("Could not load original template config from file:", err.message);
    }
  }

  // Fallback to database columns if file config is empty or missing
  if (!originalConfig || !originalConfig.defaultSections || originalConfig.defaultSections.length === 0) {
    originalConfig = {
      headerConfig: original.HeaderConfig ? JSON.parse(original.HeaderConfig) : {},
      infoFields: original.InfoFields ? JSON.parse(original.InfoFields) : [],
      columns: original.Columns ? JSON.parse(original.Columns) : [],
      defaultSections: original.DefaultSections ? JSON.parse(original.DefaultSections) : [],
    };
  }

  // Save new template config file
  const fileResult = await saveTemplateFile({
    templateName: newName,
    version: "01",
    templateCode: newTemplateCode,
    headerConfig: originalConfig.headerConfig,
    infoFields: originalConfig.infoFields,
    columns: originalConfig.columns,
    defaultSections: originalConfig.defaultSections,
  });

  // Create new template in database as draft so it goes through approval
  const result = await pool
    .request()
    .input("templateCode", sql.VarChar, newTemplateCode)
    .input("templateFileName", sql.VarChar, fileResult.fileName)
    .input("name", sql.NVarChar, newName)
    .input("description", sql.NVarChar, original.Description)
    .input("category", sql.VarChar, original.Category)
    .input("version", sql.VarChar, "01")
    .input("isActive", sql.Bit, 1)
    .input("createdBy", sql.VarChar, createdBy).query(`
      INSERT INTO AuditTemplates (
        TemplateCode, TemplateFileName, Name, Description, Category, Version, IsActive,
        ApprovalStatus, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @templateCode, @templateFileName, @name, @description, @category, @version, @isActive,
        'draft', @createdBy, GETDATE(), @createdBy, GETDATE()
      );
    `);

  await pool.close();

  const template = result.recordset[0];

  res.status(201).json({
    success: true,
    message: "Template duplicated successfully",
    data: {
      ...template,
      HeaderConfig: originalConfig?.headerConfig || null,
      InfoFields: originalConfig?.infoFields || [],
      Columns: originalConfig?.columns || [],
      DefaultSections: originalConfig?.defaultSections || [],
    },
  });
});

// Get template history (change log)
export const getTemplateHistory = tryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new AppError("Template ID is required", 400);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  try {
    const result = await pool.request()
      .input("templateId", sql.Int, id)
      .query(`
        SELECT Id, TemplateId, Action, ActionBy, ActionAt, Comments,
               PreviousStatus, NewStatus, FieldChanges
        FROM   AuditTemplateHistory
        WHERE  TemplateId = @templateId
        ORDER BY ActionAt DESC;
      `);

    const history = result.recordset.map((r) => ({
      ...r,
      FieldChanges: r.FieldChanges ? JSON.parse(r.FieldChanges) : null,
    }));

    res.status(200).json({ success: true, data: history });
  } finally {
    await pool.close();
  }
});

// Get template categories
export const getTemplateCategories = tryCatch(async (req, res) => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool.request().query(`
    SELECT DISTINCT Category, COUNT(*) AS Count
    FROM AuditTemplates
    WHERE IsDeleted = 0 AND Category IS NOT NULL
    GROUP BY Category
    ORDER BY Category;
  `);

  await pool.close();

  res.status(200).json({
    success: true,
    message: "Template categories retrieved successfully",
    data: result.recordset,
  });
});
