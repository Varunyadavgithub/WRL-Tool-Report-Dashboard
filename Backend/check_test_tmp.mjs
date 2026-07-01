import sql from "mssql";
import { dbConfig3 } from "./config/db.config.js";

const pool = await new sql.ConnectionPool(dbConfig3).connect();

const contentRows = await pool.request().input("tid", sql.Int, 101).query(`
  SELECT Id, Version, IsActiveVersion, ApprovalStatus, ChangeType, CreatedFromVersionId, SectionCount, CheckpointCount
  FROM AuditTemplateContent WHERE TemplateId = @tid ORDER BY Id
`);
console.log("AuditTemplateContent rows for TemplateId=101:");
contentRows.recordset.forEach(r => console.log(JSON.stringify(r)));

const parent = await pool.request().input("tid", sql.Int, 101).query(`
  SELECT Id, Name, Version, CurrentVersionContentId, ApprovalStatus, SectionCount, CheckpointCount FROM AuditTemplates WHERE Id = @tid
`);
console.log("\nParent row:");
console.log(JSON.stringify(parent.recordset[0]));

const history = await pool.request().input("tid", sql.Int, 101).query(`
  SELECT Action, ActionBy, VersionNumber, PreviousVersion, CreatedFromVersion, NewStatus, FieldChanges FROM AuditTemplateHistory WHERE TemplateId = @tid ORDER BY Id
`);
console.log("\nHistory rows:");
history.recordset.forEach(r => console.log(JSON.stringify(r)));

await pool.close();
