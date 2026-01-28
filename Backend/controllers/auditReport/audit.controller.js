import sql from "mssql";
import { dbConfig3 } from "../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { generateAuditCode } from "../../utils/generateCode.js";

// Helper function to calculate summary
const calculateSummary = (sections) => {
  let pass = 0,
    fail = 0,
    warning = 0,
    pending = 0;

  if (sections && Array.isArray(sections)) {
    sections.forEach((section) => {
      if (section.checkPoints && Array.isArray(section.checkPoints)) {
        section.checkPoints.forEach((cp) => {
          if (cp.status === "pass") pass++;
          else if (cp.status === "fail") fail++;
          else if (cp.status === "warning") warning++;
          else pending++;
        });
      }
    });
  }

  return {
    pass,
    fail,
    warning,
    pending,
    total: pass + fail + warning + pending,
  };
};

// Get all audits
export const getAllAudits = tryCatch(async (req, res) => {
  const {
    templateId,
    status,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const request = pool.request();

  let whereConditions = ["IsDeleted = 0"];

  if (templateId) {
    request.input("templateId", sql.Int, templateId);
    whereConditions.push("TemplateId = @templateId");
  }

  if (status) {
    request.input("status", sql.VarChar, status);
    whereConditions.push("Status = @status");
  }

  if (search) {
    request.input("search", sql.NVarChar, `%${search}%`);
    whereConditions.push(
      "(ReportName LIKE @search OR TemplateName LIKE @search OR AuditCode LIKE @search)",
    );
  }

  if (startDate) {
    request.input("startDate", sql.DateTime, new Date(startDate));
    whereConditions.push("CreatedAt >= @startDate");
  }

  if (endDate) {
    request.input("endDate", sql.DateTime, new Date(endDate));
    whereConditions.push("CreatedAt <= @endDate");
  }

  request.input("offset", sql.Int, offset);
  request.input("limit", sql.Int, parseInt(limit));

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    WITH AuditData AS (
      SELECT 
        Id,
        AuditCode,
        TemplateId,
        TemplateName,
        ReportName,
        FormatNo,
        RevNo,
        RevDate,
        Notes,
        Status,
        InfoData,
        Sections,
        Summary,
        CreatedBy,
        CreatedAt,
        UpdatedBy,
        UpdatedAt,
        SubmittedBy,
        SubmittedAt,
        ApprovedBy,
        ApprovedAt,
        ApprovalComments,
        ROW_NUMBER() OVER (ORDER BY CreatedAt DESC) AS RowNum
      FROM Audits
      ${whereClause}
    )
    SELECT 
      (SELECT COUNT(*) FROM AuditData) AS TotalCount,
      *
    FROM AuditData
    WHERE RowNum > @offset AND RowNum <= (@offset + @limit);
  `;

  const result = await request.query(query);

  // Parse JSON fields
  const audits = result.recordset.map((audit) => ({
    ...audit,
    InfoData: audit.InfoData ? JSON.parse(audit.InfoData) : {},
    Sections: audit.Sections ? JSON.parse(audit.Sections) : [],
    Summary: audit.Summary ? JSON.parse(audit.Summary) : {},
  }));

  res.status(200).json({
    success: true,
    message: "Audits retrieved successfully",
    data: audits,
    totalCount:
      result.recordset.length > 0 ? result.recordset[0].TotalCount : 0,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// Get audit by ID
export const getAuditById = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Audit ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const result = await pool.request().input("id", sql.Int, id).query(`
      SELECT 
        Id,
        AuditCode,
        TemplateId,
        TemplateName,
        ReportName,
        FormatNo,
        RevNo,
        RevDate,
        Notes,
        Status,
        InfoData,
        Sections,
        Columns,
        InfoFields,
        HeaderConfig,
        Summary,
        CreatedBy,
        CreatedAt,
        UpdatedBy,
        UpdatedAt,
        SubmittedBy,
        SubmittedAt,
        ApprovedBy,
        ApprovedAt,
        ApprovalComments
      FROM Audits
      WHERE Id = @id AND IsDeleted = 0
    `);

  if (result.recordset.length === 0) {
    throw new AppError("Audit not found", 404);
  }

  const audit = result.recordset[0];

  res.status(200).json({
    success: true,
    message: "Audit retrieved successfully",
    data: {
      ...audit,
      InfoData: audit.InfoData ? JSON.parse(audit.InfoData) : {},
      Sections: audit.Sections ? JSON.parse(audit.Sections) : [],
      Columns: audit.Columns ? JSON.parse(audit.Columns) : [],
      InfoFields: audit.InfoFields ? JSON.parse(audit.InfoFields) : [],
      HeaderConfig: audit.HeaderConfig ? JSON.parse(audit.HeaderConfig) : {},
      Summary: audit.Summary ? JSON.parse(audit.Summary) : {},
    },
  });
});

// Create audit
export const createAudit = tryCatch(async (req, res) => {
  const {
    templateId,
    templateName,
    reportName,
    formatNo,
    revNo,
    revDate,
    notes,
    infoData,
    sections,
    columns,
    infoFields,
    headerConfig,
    status = "draft",
  } = req.body;

  if (!templateId || !reportName) {
    throw new AppError("Template ID and Report Name are required", 400);
  }

  const auditCode = await generateAuditCode("AUD");
  const createdBy = req.user?.userCode || "SYSTEM";
  const summary = calculateSummary(sections);

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Get template details if not provided
  let finalColumns = columns;
  let finalInfoFields = infoFields;
  let finalHeaderConfig = headerConfig;
  let finalTemplateName = templateName;

  if (!columns || !infoFields || !headerConfig) {
    const templateResult = await pool
      .request()
      .input("templateId", sql.Int, templateId)
      .query(
        "SELECT Name, Columns, InfoFields, HeaderConfig FROM AuditTemplates WHERE Id = @templateId",
      );

    if (templateResult.recordset.length > 0) {
      const template = templateResult.recordset[0];
      finalColumns = columns || JSON.parse(template.Columns || "[]");
      finalInfoFields = infoFields || JSON.parse(template.InfoFields || "[]");
      finalHeaderConfig =
        headerConfig || JSON.parse(template.HeaderConfig || "{}");
      finalTemplateName = templateName || template.Name;
    }
  }

  const result = await pool
    .request()
    .input("auditCode", sql.VarChar, auditCode)
    .input("templateId", sql.Int, templateId)
    .input("templateName", sql.NVarChar, finalTemplateName)
    .input("reportName", sql.NVarChar, reportName)
    .input("formatNo", sql.VarChar, formatNo || null)
    .input("revNo", sql.VarChar, revNo || null)
    .input("revDate", sql.Date, revDate ? new Date(revDate) : null)
    .input("notes", sql.NVarChar, notes || null)
    .input("status", sql.VarChar, status)
    .input("infoData", sql.NVarChar, JSON.stringify(infoData || {}))
    .input("sections", sql.NVarChar, JSON.stringify(sections || []))
    .input("columns", sql.NVarChar, JSON.stringify(finalColumns || []))
    .input("infoFields", sql.NVarChar, JSON.stringify(finalInfoFields || []))
    .input(
      "headerConfig",
      sql.NVarChar,
      JSON.stringify(finalHeaderConfig || {}),
    )
    .input("summary", sql.NVarChar, JSON.stringify(summary))
    .input("createdBy", sql.VarChar, createdBy).query(`
      INSERT INTO Audits (
        AuditCode, TemplateId, TemplateName, ReportName, FormatNo, RevNo, RevDate,
        Notes, Status, InfoData, Sections, Columns, InfoFields, HeaderConfig, Summary,
        CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @auditCode, @templateId, @templateName, @reportName, @formatNo, @revNo, @revDate,
        @notes, @status, @infoData, @sections, @columns, @infoFields, @headerConfig, @summary,
        @createdBy, GETDATE(), @createdBy, GETDATE()
      );
    `);

  const audit = result.recordset[0];

  // Log to history
  await pool
    .request()
    .input("auditId", sql.Int, audit.Id)
    .input("action", sql.VarChar, "created")
    .input("actionBy", sql.VarChar, createdBy)
    .input("newData", sql.NVarChar, JSON.stringify(audit)).query(`
      INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt, NewData)
      VALUES (@auditId, @action, @actionBy, GETDATE(), @newData);
    `);

  res.status(201).json({
    success: true,
    message: "Audit created successfully",
    data: {
      ...audit,
      InfoData: audit.InfoData ? JSON.parse(audit.InfoData) : {},
      Sections: audit.Sections ? JSON.parse(audit.Sections) : [],
      Columns: audit.Columns ? JSON.parse(audit.Columns) : [],
      InfoFields: audit.InfoFields ? JSON.parse(audit.InfoFields) : [],
      HeaderConfig: audit.HeaderConfig ? JSON.parse(audit.HeaderConfig) : {},
      Summary: audit.Summary ? JSON.parse(audit.Summary) : {},
    },
  });
});

// Update audit
export const updateAudit = tryCatch(async (req, res) => {
  const { id } = req.params;
  const {
    reportName,
    formatNo,
    revNo,
    revDate,
    notes,
    infoData,
    sections,
    status,
  } = req.body;

  if (!id) {
    throw new AppError("Audit ID is required", 400);
  }

  const updatedBy = req.user?.userCode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Get current audit data for history
  const currentResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM Audits WHERE Id = @id AND IsDeleted = 0");

  if (currentResult.recordset.length === 0) {
    throw new AppError("Audit not found", 404);
  }

  const currentAudit = currentResult.recordset[0];

  // Check if audit can be edited
  if (currentAudit.Status === "approved") {
    throw new AppError("Cannot edit an approved audit", 400);
  }

  const summary = sections
    ? calculateSummary(sections)
    : JSON.parse(currentAudit.Summary || "{}");

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("reportName", sql.NVarChar, reportName || currentAudit.ReportName)
    .input(
      "formatNo",
      sql.VarChar,
      formatNo !== undefined ? formatNo : currentAudit.FormatNo,
    )
    .input(
      "revNo",
      sql.VarChar,
      revNo !== undefined ? revNo : currentAudit.RevNo,
    )
    .input(
      "revDate",
      sql.Date,
      revDate ? new Date(revDate) : currentAudit.RevDate,
    )
    .input(
      "notes",
      sql.NVarChar,
      notes !== undefined ? notes : currentAudit.Notes,
    )
    .input("status", sql.VarChar, status || currentAudit.Status)
    .input(
      "infoData",
      sql.NVarChar,
      infoData ? JSON.stringify(infoData) : currentAudit.InfoData,
    )
    .input(
      "sections",
      sql.NVarChar,
      sections ? JSON.stringify(sections) : currentAudit.Sections,
    )
    .input("summary", sql.NVarChar, JSON.stringify(summary))
    .input("updatedBy", sql.VarChar, updatedBy).query(`
      UPDATE Audits
      SET 
        ReportName = @reportName,
        FormatNo = @formatNo,
        RevNo = @revNo,
        RevDate = @revDate,
        Notes = @notes,
        Status = @status,
        InfoData = @infoData,
        Sections = @sections,
        Summary = @summary,
        UpdatedBy = @updatedBy,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND IsDeleted = 0;
    `);

  const audit = result.recordset[0];

  // Log to history
  await pool
    .request()
    .input("auditId", sql.Int, id)
    .input("action", sql.VarChar, "updated")
    .input("actionBy", sql.VarChar, updatedBy)
    .input("previousData", sql.NVarChar, JSON.stringify(currentAudit))
    .input("newData", sql.NVarChar, JSON.stringify(audit)).query(`
      INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt, PreviousData, NewData)
      VALUES (@auditId, @action, @actionBy, GETDATE(), @previousData, @newData);
    `);

  res.status(200).json({
    success: true,
    message: "Audit updated successfully",
    data: {
      ...audit,
      InfoData: audit.InfoData ? JSON.parse(audit.InfoData) : {},
      Sections: audit.Sections ? JSON.parse(audit.Sections) : [],
      Columns: audit.Columns ? JSON.parse(audit.Columns) : [],
      InfoFields: audit.InfoFields ? JSON.parse(audit.InfoFields) : [],
      HeaderConfig: audit.HeaderConfig ? JSON.parse(audit.HeaderConfig) : {},
      Summary: audit.Summary ? JSON.parse(audit.Summary) : {},
    },
  });
});

// Delete audit (soft delete)
export const deleteAudit = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Audit ID is required", 400);
  }

  const updatedBy = req.user?.userCode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Check if audit exists
  const checkResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT Id, Status FROM Audits WHERE Id = @id AND IsDeleted = 0");

  if (checkResult.recordset.length === 0) {
    throw new AppError("Audit not found", 404);
  }

  const currentAudit = checkResult.recordset[0];

  // Check if audit can be deleted
  if (currentAudit.Status === "approved") {
    throw new AppError("Cannot delete an approved audit", 400);
  }

  await pool
    .request()
    .input("id", sql.Int, id)
    .input("updatedBy", sql.VarChar, updatedBy).query(`
      UPDATE Audits
      SET IsDeleted = 1, UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
      WHERE Id = @id;
    `);

  // Log to history
  await pool
    .request()
    .input("auditId", sql.Int, id)
    .input("action", sql.VarChar, "deleted")
    .input("actionBy", sql.VarChar, updatedBy).query(`
      INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt)
      VALUES (@auditId, @action, @actionBy, GETDATE());
    `);

  res.status(200).json({
    success: true,
    message: "Audit deleted successfully",
  });
});

// Submit audit for approval
export const submitAudit = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Audit ID is required", 400);
  }

  const submittedBy = req.user?.userCode || "SYSTEM";

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Check if audit exists and is in draft status
  const checkResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM Audits WHERE Id = @id AND IsDeleted = 0");

  if (checkResult.recordset.length === 0) {
    throw new AppError("Audit not found", 404);
  }

  const currentAudit = checkResult.recordset[0];

  if (currentAudit.Status !== "draft") {
    throw new AppError(
      `Cannot submit audit with status: ${currentAudit.Status}`,
      400,
    );
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("submittedBy", sql.VarChar, submittedBy).query(`
      UPDATE Audits
      SET 
        Status = 'submitted',
        SubmittedBy = @submittedBy,
        SubmittedAt = GETDATE(),
        UpdatedBy = @submittedBy,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND IsDeleted = 0;
    `);

  const audit = result.recordset[0];

  // Log to history
  await pool
    .request()
    .input("auditId", sql.Int, id)
    .input("action", sql.VarChar, "submitted")
    .input("actionBy", sql.VarChar, submittedBy).query(`
      INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt)
      VALUES (@auditId, @action, @actionBy, GETDATE());
    `);

  res.status(200).json({
    success: true,
    message: "Audit submitted successfully",
    data: {
      ...audit,
      InfoData: audit.InfoData ? JSON.parse(audit.InfoData) : {},
      Sections: audit.Sections ? JSON.parse(audit.Sections) : [],
      Summary: audit.Summary ? JSON.parse(audit.Summary) : {},
    },
  });
});

// Approve audit
export const approveAudit = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { approverName, comments } = req.body;

  if (!id) {
    throw new AppError("Audit ID is required", 400);
  }

  if (!approverName) {
    throw new AppError("Approver name is required", 400);
  }

  const approvedBy = req.user?.userCode || approverName;

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Check if audit exists and is in submitted status
  const checkResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM Audits WHERE Id = @id AND IsDeleted = 0");

  if (checkResult.recordset.length === 0) {
    throw new AppError("Audit not found", 404);
  }

  const currentAudit = checkResult.recordset[0];

  if (currentAudit.Status !== "submitted") {
    throw new AppError(
      `Cannot approve audit with status: ${currentAudit.Status}`,
      400,
    );
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("approvedBy", sql.VarChar, approverName)
    .input("comments", sql.NVarChar, comments || null)
    .input("updatedBy", sql.VarChar, approvedBy).query(`
      UPDATE Audits
      SET 
        Status = 'approved',
        ApprovedBy = @approvedBy,
        ApprovedAt = GETDATE(),
        ApprovalComments = @comments,
        UpdatedBy = @updatedBy,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND IsDeleted = 0;
    `);

  const audit = result.recordset[0];

  // Log to history
  await pool
    .request()
    .input("auditId", sql.Int, id)
    .input("action", sql.VarChar, "approved")
    .input("actionBy", sql.VarChar, approverName)
    .input("comments", sql.NVarChar, comments || null).query(`
      INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt, Comments)
      VALUES (@auditId, @action, @actionBy, GETDATE(), @comments);
    `);

  res.status(200).json({
    success: true,
    message: "Audit approved successfully",
    data: {
      ...audit,
      InfoData: audit.InfoData ? JSON.parse(audit.InfoData) : {},
      Sections: audit.Sections ? JSON.parse(audit.Sections) : [],
      Summary: audit.Summary ? JSON.parse(audit.Summary) : {},
    },
  });
});

// Reject audit
export const rejectAudit = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { approverName, comments } = req.body;

  if (!id) {
    throw new AppError("Audit ID is required", 400);
  }

  if (!approverName) {
    throw new AppError("Approver name is required", 400);
  }

  if (!comments) {
    throw new AppError("Rejection reason is required", 400);
  }

  const rejectedBy = req.user?.userCode || approverName;

  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  // Check if audit exists and is in submitted status
  const checkResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM Audits WHERE Id = @id AND IsDeleted = 0");

  if (checkResult.recordset.length === 0) {
    throw new AppError("Audit not found", 404);
  }

  const currentAudit = checkResult.recordset[0];

  if (currentAudit.Status !== "submitted") {
    throw new AppError(
      `Cannot reject audit with status: ${currentAudit.Status}`,
      400,
    );
  }

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("approvedBy", sql.VarChar, approverName)
    .input("comments", sql.NVarChar, comments)
    .input("updatedBy", sql.VarChar, rejectedBy).query(`
      UPDATE Audits
      SET 
        Status = 'rejected',
        ApprovedBy = @approvedBy,
        ApprovedAt = GETDATE(),
        ApprovalComments = @comments,
        UpdatedBy = @updatedBy,
        UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @id AND IsDeleted = 0;
    `);

  const audit = result.recordset[0];

  // Log to history
  await pool
    .request()
    .input("auditId", sql.Int, id)
    .input("action", sql.VarChar, "rejected")
    .input("actionBy", sql.VarChar, approverName)
    .input("comments", sql.NVarChar, comments).query(`
      INSERT INTO AuditHistory (AuditId, Action, ActionBy, ActionAt, Comments)
      VALUES (@auditId, @action, @actionBy, GETDATE(), @comments);
    `);

  res.status(200).json({
    success: true,
    message: "Audit rejected successfully",
    data: {
      ...audit,
      InfoData: audit.InfoData ? JSON.parse(audit.InfoData) : {},
      Sections: audit.Sections ? JSON.parse(audit.Sections) : [],
      Summary: audit.Summary ? JSON.parse(audit.Summary) : {},
    },
  });
});

// Get audit history
export const getAuditHistory = tryCatch(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new AppError("Audit ID is required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const result = await pool.request().input("auditId", sql.Int, id).query(`
      SELECT 
        Id,
        AuditId,
        Action,
        ActionBy,
        ActionAt,
        Comments
      FROM AuditHistory
      WHERE AuditId = @auditId
      ORDER BY ActionAt DESC;
    `);

  res.status(200).json({
    success: true,
    message: "Audit history retrieved successfully",
    data: result.recordset,
  });
});

// Get audit statistics
export const getAuditStats = tryCatch(async (req, res) => {
  const { startDate, endDate, templateId } = req.query;

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const request = pool.request();

  let whereConditions = ["IsDeleted = 0"];

  if (startDate) {
    request.input("startDate", sql.DateTime, new Date(startDate));
    whereConditions.push("CreatedAt >= @startDate");
  }

  if (endDate) {
    request.input("endDate", sql.DateTime, new Date(endDate));
    whereConditions.push("CreatedAt <= @endDate");
  }

  if (templateId) {
    request.input("templateId", sql.Int, templateId);
    whereConditions.push("TemplateId = @templateId");
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const result = await request.query(`
    SELECT 
      COUNT(*) AS TotalAudits,
      SUM(CASE WHEN Status = 'draft' THEN 1 ELSE 0 END) AS DraftCount,
      SUM(CASE WHEN Status = 'submitted' THEN 1 ELSE 0 END) AS SubmittedCount,
      SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) AS ApprovedCount,
      SUM(CASE WHEN Status = 'rejected' THEN 1 ELSE 0 END) AS RejectedCount
    FROM Audits
    ${whereClause};
  `);

  // Get template-wise stats
  const templateStats = await request.query(`
    SELECT 
      TemplateName,
      TemplateId,
      COUNT(*) AS AuditCount,
      SUM(CASE WHEN Status = 'approved' THEN 1 ELSE 0 END) AS ApprovedCount
    FROM Audits
    ${whereClause}
    GROUP BY TemplateName, TemplateId
    ORDER BY AuditCount DESC;
  `);

  res.status(200).json({
    success: true,
    message: "Audit statistics retrieved successfully",
    data: {
      summary: result.recordset[0],
      templateStats: templateStats.recordset,
    },
  });
});

// Export audit data
export const exportAuditData = tryCatch(async (req, res) => {
  const { startDate, endDate, templateId, status } = req.query;

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const request = pool.request();

  let whereConditions = ["IsDeleted = 0"];

  if (startDate) {
    request.input("startDate", sql.DateTime, new Date(startDate));
    whereConditions.push("CreatedAt >= @startDate");
  }

  if (endDate) {
    request.input("endDate", sql.DateTime, new Date(endDate));
    whereConditions.push("CreatedAt <= @endDate");
  }

  if (templateId) {
    request.input("templateId", sql.Int, templateId);
    whereConditions.push("TemplateId = @templateId");
  }

  if (status) {
    request.input("status", sql.VarChar, status);
    whereConditions.push("Status = @status");
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const result = await request.query(`
    SELECT 
      AuditCode,
      TemplateName,
      ReportName,
      FormatNo,
      RevNo,
      RevDate,
      Status,
      InfoData,
      Summary,
      CreatedBy,
      CreatedAt,
      SubmittedBy,
      SubmittedAt,
      ApprovedBy,
      ApprovedAt,
      ApprovalComments
    FROM Audits
    ${whereClause}
    ORDER BY CreatedAt DESC;
  `);

  // Parse JSON and flatten data for export
  const exportData = result.recordset.map((audit) => {
    const infoData = audit.InfoData ? JSON.parse(audit.InfoData) : {};
    const summary = audit.Summary ? JSON.parse(audit.Summary) : {};

    return {
      AuditCode: audit.AuditCode,
      TemplateName: audit.TemplateName,
      ReportName: audit.ReportName,
      FormatNo: audit.FormatNo,
      RevNo: audit.RevNo,
      RevDate: audit.RevDate,
      Status: audit.Status,
      ModelName: infoData.modelName || "",
      Date: infoData.date || "",
      Shift: infoData.shift || "",
      EID: infoData.eid || "",
      TotalChecks: summary.total || 0,
      PassCount: summary.pass || 0,
      FailCount: summary.fail || 0,
      WarningCount: summary.warning || 0,
      PendingCount: summary.pending || 0,
      PassRate:
        summary.total > 0
          ? Math.round((summary.pass / summary.total) * 100)
          : 0,
      CreatedBy: audit.CreatedBy,
      CreatedAt: audit.CreatedAt,
      SubmittedBy: audit.SubmittedBy,
      SubmittedAt: audit.SubmittedAt,
      ApprovedBy: audit.ApprovedBy,
      ApprovedAt: audit.ApprovedAt,
      ApprovalComments: audit.ApprovalComments,
    };
  });

  res.status(200).json({
    success: true,
    message: "Audit data exported successfully",
    data: exportData,
    totalCount: exportData.length,
  });
});
