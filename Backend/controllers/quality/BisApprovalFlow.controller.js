import sql from "mssql";
import path from "path";
import fs from "fs";
import { dbConfig1, connectToDB } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { UPLOADS_DIR } from "../../utils/storage/config.js";

const ROLE_COLUMNS = {
  preparer: { userCode: "PreparerUserCode", signature: "PreparerSignaturePath" },
  reviewer: { userCode: "ReviewerUserCode", signature: "ReviewerSignaturePath" },
  authorizer: { userCode: "AuthorizerUserCode", signature: "AuthorizerSignaturePath" },
};

/* ═══════════════════════════════════════════════════════════════════════
   GET — current flow assignment (who holds each role + their signature),
   with names resolved from Users for display.
═══════════════════════════════════════════════════════════════════════ */
export const getBisApprovalFlow = tryCatch(async (_, res) => {
  const pool = await connectToDB(dbConfig1);

  const result = await pool.request().query(`
    SELECT TOP 1
      f.Id,
      f.PreparerUserCode, f.PreparerSignaturePath, pu.UserName AS PreparerUserName,
      f.ReviewerUserCode, f.ReviewerSignaturePath, ru.UserName AS ReviewerUserName,
      f.AuthorizerUserCode, f.AuthorizerSignaturePath, au.UserName AS AuthorizerUserName,
      f.UpdatedBy, f.UpdatedAt
    FROM BISApprovalFlow f
    LEFT JOIN Users pu ON pu.UserCode = f.PreparerUserCode
    LEFT JOIN Users ru ON ru.UserCode = f.ReviewerUserCode
    LEFT JOIN Users au ON au.UserCode = f.AuthorizerUserCode
    ORDER BY f.Id
  `);

  if (result.recordset.length === 0) {
    throw new AppError("BIS approval flow is not configured.", 404);
  }

  const row = result.recordset[0];
  res.status(200).json({
    success: true,
    flow: {
      id: row.Id,
      preparerUserCode: row.PreparerUserCode,
      preparerUserName: row.PreparerUserName,
      preparerSignaturePath: row.PreparerSignaturePath,
      reviewerUserCode: row.ReviewerUserCode,
      reviewerUserName: row.ReviewerUserName,
      reviewerSignaturePath: row.ReviewerSignaturePath,
      authorizerUserCode: row.AuthorizerUserCode,
      authorizerUserName: row.AuthorizerUserName,
      authorizerSignaturePath: row.AuthorizerSignaturePath,
      updatedBy: row.UpdatedBy,
      updatedAt: row.UpdatedAt,
    },
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   PUT — reassign which user holds each role
═══════════════════════════════════════════════════════════════════════ */
export const updateBisApprovalFlow = tryCatch(async (req, res) => {
  const { preparerUserCode, reviewerUserCode, authorizerUserCode } = req.body;

  if (!preparerUserCode || !reviewerUserCode || !authorizerUserCode) {
    throw new AppError("preparerUserCode, reviewerUserCode, and authorizerUserCode are all required.", 400);
  }

  const updatedBy = req.user?.name || req.user?.usercode || "system";
  const pool = await connectToDB(dbConfig1);

  const check = await pool.request()
    .input("P", sql.NVarChar(50), preparerUserCode)
    .input("R", sql.NVarChar(50), reviewerUserCode)
    .input("A", sql.NVarChar(50), authorizerUserCode)
    .query(`SELECT UserCode FROM Users WHERE UserCode IN (@P, @R, @A)`);
  const found = new Set(check.recordset.map((r) => r.UserCode));
  for (const [label, code] of [["Preparer", preparerUserCode], ["Reviewer", reviewerUserCode], ["Authorizer", authorizerUserCode]]) {
    if (!found.has(code)) throw new AppError(`${label} user code "${code}" was not found.`, 400);
  }

  const existing = await pool.request().query(`SELECT TOP 1 Id FROM BISApprovalFlow ORDER BY Id`);
  if (existing.recordset.length === 0) {
    throw new AppError("BIS approval flow is not configured.", 404);
  }

  await pool.request()
    .input("Id", sql.Int, existing.recordset[0].Id)
    .input("PreparerUserCode", sql.NVarChar(50), preparerUserCode)
    .input("ReviewerUserCode", sql.NVarChar(50), reviewerUserCode)
    .input("AuthorizerUserCode", sql.NVarChar(50), authorizerUserCode)
    .input("UpdatedBy", sql.NVarChar(100), updatedBy)
    .query(`
      UPDATE BISApprovalFlow SET
        PreparerUserCode = @PreparerUserCode,
        ReviewerUserCode = @ReviewerUserCode,
        AuthorizerUserCode = @AuthorizerUserCode,
        UpdatedBy = @UpdatedBy, UpdatedAt = GETDATE()
      WHERE Id = @Id
    `);

  res.status(200).json({ success: true, message: "BIS approval flow updated successfully." });
});

/* ═══════════════════════════════════════════════════════════════════════
   POST /:role — upload a signature image for one role. Overwrites whatever
   that role's signature currently is; the old file is best-effort removed.
   Report rows already signed keep their own snapshotted path untouched.
═══════════════════════════════════════════════════════════════════════ */
export const uploadBisApprovalSignature = tryCatch(async (req, res) => {
  const { role } = req.params;
  const cols = ROLE_COLUMNS[role];
  if (!cols) throw new AppError("Invalid role. Must be one of: preparer, reviewer, authorizer.", 400);
  if (!req.file) throw new AppError("Signature image file is required.", 400);

  const pool = await connectToDB(dbConfig1);
  const existing = await pool.request().query(`SELECT TOP 1 Id, ${cols.signature} AS OldPath FROM BISApprovalFlow ORDER BY Id`);
  if (existing.recordset.length === 0) {
    throw new AppError("BIS approval flow is not configured.", 404);
  }

  const newPath = `/uploads/BISSignatures/${req.file.filename}`;
  await pool.request()
    .input("Id", sql.Int, existing.recordset[0].Id)
    .input("Path", sql.NVarChar(300), newPath)
    .query(`UPDATE BISApprovalFlow SET ${cols.signature} = @Path, UpdatedAt = GETDATE() WHERE Id = @Id`);

  const oldPath = existing.recordset[0].OldPath;
  if (oldPath) {
    const fullOld = path.join(UPLOADS_DIR, oldPath.replace(/^\/uploads\//, ""));
    fs.unlink(fullOld, () => {});
  }

  res.status(200).json({ success: true, message: "Signature uploaded successfully.", path: newPath });
});

/* ═══════════════════════════════════════════════════════════════════════
   GET users — active GARUDA users, for the role-assignment dropdowns
═══════════════════════════════════════════════════════════════════════ */
export const getBisApprovalUsers = tryCatch(async (_, res) => {
  const pool = await connectToDB(dbConfig1);
  const result = await pool.request().query(`
    SELECT UserCode, UserName, UserID
    FROM Users
    WHERE Status = 1
    ORDER BY UserName
  `);
  res.status(200).json({ success: true, users: result.recordset });
});
