import sql from "mssql";
import { dbConfig3 } from "../config/db.config.js";

export const generateTemplateCode = async () => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool
    .request()
    .output("Code", sql.VarChar(50))
    .execute("GenerateTemplateCode");
  return result.output.Code;
};

export const generateAuditCode = async (prefix = "AUD") => {
  const pool = await new sql.ConnectionPool(dbConfig3).connect();

  const result = await pool
    .request()
    .input("Prefix", sql.VarChar(10), prefix)
    .output("Code", sql.VarChar(50))
    .execute("GenerateAuditCode");
  return result.output.Code;
};
