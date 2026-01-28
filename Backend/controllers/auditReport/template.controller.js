import sql from "mssql";
import { dbConfig3 } from "../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateTemplateCode } from "../../utils/generateCode.js";

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

  if (isActive != undefined) {
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
        Name,
        Description,
        Category,
        Version,
        IsActive,
        HeaderConfig,
        InfoFields,
        Columns,
        DefaultSections,
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

  // Parse JSON fields
  const templates = result.recordset.map((template) => ({
    ...template,
    HeaderConfig: template.HeaderConfig
      ? JSON.parse(template.HeaderConfig)
      : null,
    InfoFields: template.InfoFields ? JSON.parse(template.InfoFields) : [],
    Columns: template.Columns ? JSON.parse(template.Columns) : [],
    DefaultSections: template.DefaultSections
      ? JSON.parse(template.DefaultSections)
      : [],
  }));

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
  const result = (pool.request().input("id", sql.Int, id).query = `
    SELECT 
        Id,
        TemplateCode,
        Name,
        Description,
        Category,
        Version,
        IsActive,
        HeaderConfig,
        InfoFields,
        Columns,
        DefaultSections,
        CreatedBy,
        CreatedAt,
        UpdatedBy,
        UpdatedAt
      FROM AuditTemplates
      WHERE Id = @id AND IsDeleted = 0
  `);

  if (result.recordset.length === 0) {
    throw new AppError("Template not found", 404);
  }

  const template = result.recordset[0];

  res.status(200).json({
    success: true,
    message: "Template retrieved successfully",
    data: {
      ...template,
      HeaderConfig: template.HeaderConfig
        ? JSON.parse(template.HeaderConfig)
        : null,
      InfoFields: template.InfoFields ? JSON.parse(template.InfoFields) : [],
      Columns: template.Columns ? JSON.parse(template.Columns) : [],
      DefaultSections: template.DefaultSections
        ? JSON.parse(template.DefaultSections)
        : [],
    },
  });
});

// Create template
export const createTemplate = tryCatch(async (req, res) => {
  const {
    name,
    description,
    category,
    version,
    isActive,
    headerConfig,
    infoFields,
    columns,
    defaultSections,
  } = req.body;

  if (!name) {
    throw new AppError("Template name is required", 400);
  }

  const templateCode = await generateTemplateCode();
  const createdBy = req.user?.userCode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const result = pool
    .request()
    .input("templateCode", sql.VarChar, templateCode)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description || null)
    .input("category", sql.VarChar, category || null)
    .input("version", sql.VarChar, version || "1.0")
    .input("isActive", sql.Bit, isActive !== false ? 1 : 0)
    .input("headerConfig", sql.NVarChar, JSON.stringify(headerConfig || {}))
    .input("infoFields", sql.NVarChar, JSON.stringify(infoFields || []))
    .input("columns", sql.NVarChar, JSON.stringify(columns || []))
    .input(
      "defaultSections",
      sql.NVarChar,
      JSON.stringify(defaultSections || []),
    )
    .input("createdBy", sql.VarChar, createdBy).query(`
      INSERT INTO AuditTemplates (
        TemplateCode, Name, Description, Category, Version, IsActive,
        HeaderConfig, InfoFields, Columns, DefaultSections,
        CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @templateCode, @name, @description, @category, @version, @isActive,
        @headerConfig, @infoFields, @columns, @defaultSections,
        @createdBy, GETDATE(), @createdBy, GETDATE()
      );
    `);

  const template = result.recordset[0];

  res.status(201).json({
    success: true,
    message: "Template created successfully",
    data: {
      ...template,
      HeaderConfig: template.HeaderConfig
        ? JSON.parse(template.HeaderConfig)
        : null,
      InfoFields: template.InfoFields ? JSON.parse(template.InfoFields) : [],
      Columns: template.Columns ? JSON.parse(template.Columns) : [],
      DefaultSections: template.DefaultSections
        ? JSON.parse(template.DefaultSections)
        : [],
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
    headerConfig,
    infoFields,
    columns,
    defaultSections,
  } = req.body;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const updatedBy = req.user?.userCode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Check if template exists
  const checkResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT Id FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0");

  if (checkResult.recordset.length === 0) {
    throw new AppError("Template not found", 404);
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description || null)
    .input("category", sql.VarChar, category || null)
    .input("version", sql.VarChar, version || "1.0")
    .input("isActive", sql.Bit, isActive !== false ? 1 : 0)
    .input("headerConfig", sql.NVarChar, JSON.stringify(headerConfig || {}))
    .input("infoFields", sql.NVarChar, JSON.stringify(infoFields || []))
    .input("columns", sql.NVarChar, JSON.stringify(columns || []))
    .input(
      "defaultSections",
      sql.NVarChar,
      JSON.stringify(defaultSections || []),
    )
    .input("updatedBy", sql.VarChar, updatedBy).query(`
      UPDATE AuditTemplates
      SET 
        Name = @name,
        Description = @description,
        Category = @category,
        Version = @version,
        IsActive = @isActive,
        HeaderConfig = @headerConfig,
        InfoFields = @infoFields,
        Columns = @columns,
        DefaultSections = @defaultSections,
        UpdatedBy = @updatedBy,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND IsDeleted = 0;
    `);

  const template = result.recordset[0];

  res.status(200).json({
    success: true,
    message: "Template updated successfully",
    data: {
      ...template,
      HeaderConfig: template.HeaderConfig
        ? JSON.parse(template.HeaderConfig)
        : null,
      InfoFields: template.InfoFields ? JSON.parse(template.InfoFields) : [],
      Columns: template.Columns ? JSON.parse(template.Columns) : [],
      DefaultSections: template.DefaultSections
        ? JSON.parse(template.DefaultSections)
        : [],
    },
  });
});

// Delete template (soft delete)
export const deleteTemplate = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Template ID is required", 400);
  }

  const updatedBy = req.user?.userCode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Check if template exists
  const checkResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT Id FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0");

  if (checkResult.recordset.length === 0) {
    throw new AppError("Template not found", 404);
  }

  // Check if template is used in any audits
  const auditCheck = await pool
    .request()
    .input("templateId", sql.Int, id)
    .query(
      "SELECT COUNT(*) AS Count FROM Audits WHERE TemplateId = @templateId AND IsDeleted = 0",
    );

  if (auditCheck.recordset[0].Count > 0) {
    throw new AppError(
      "Cannot delete template. It is used in existing audits.",
      400,
    );
  }

  await pool
    .request()
    .input("id", sql.Int, id)
    .input("updatedBy", sql.VarChar, updatedBy).query(`
      UPDATE AuditTemplates
      SET IsDeleted = 1, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
      WHERE Id = @id;
    `);

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

  // Get original template
  const originalResult = await pool.request().input("id", sql.Int, id).query(`
      SELECT * FROM AuditTemplates WHERE Id = @id AND IsDeleted = 0
    `);

  if (originalResult.recordset.length === 0) {
    throw new AppError("Template not found", 404);
  }

  const original = originalResult.recordset[0];
  const templateCode = await generateTemplateCode();
  const createdBy = req.user?.userCode || "SYSTEM";

  const result = await pool
    .request()
    .input("templateCode", sql.VarChar, templateCode)
    .input("name", sql.NVarChar, `${original.Name} (Copy)`)
    .input("description", sql.NVarChar, original.Description)
    .input("category", sql.VarChar, original.Category)
    .input("version", sql.VarChar, "1.0")
    .input("isActive", sql.Bit, 1)
    .input("headerConfig", sql.NVarChar, original.HeaderConfig)
    .input("infoFields", sql.NVarChar, original.InfoFields)
    .input("columns", sql.NVarChar, original.Columns)
    .input("defaultSections", sql.NVarChar, original.DefaultSections)
    .input("createdBy", sql.VarChar, createdBy).query(`
      INSERT INTO AuditTemplates (
        TemplateCode, Name, Description, Category, Version, IsActive,
        HeaderConfig, InfoFields, Columns, DefaultSections,
        CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @templateCode, @name, @description, @category, @version, @isActive,
        @headerConfig, @infoFields, @columns, @defaultSections,
        @createdBy, GETDATE(), @createdBy, GETDATE()
      );
    `);

  const template = result.recordset[0];

  res.status(201).json({
    success: true,
    message: "Template duplicated successfully",
    data: {
      ...template,
      HeaderConfig: template.HeaderConfig
        ? JSON.parse(template.HeaderConfig)
        : null,
      InfoFields: template.InfoFields ? JSON.parse(template.InfoFields) : [],
      Columns: template.Columns ? JSON.parse(template.Columns) : [],
      DefaultSections: template.DefaultSections
        ? JSON.parse(template.DefaultSections)
        : [],
    },
  });
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

  res.status(200).json({
    success: true,
    message: "Template categories retrieved successfully",
    data: result.recordset,
  });
});
