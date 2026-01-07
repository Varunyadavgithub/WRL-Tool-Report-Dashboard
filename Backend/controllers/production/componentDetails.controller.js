import sql from "mssql";
import { dbConfig1 } from "../../config/db.js";
import { tryCatch } from "../../config/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Fetches detailed information about components based on a provided serial number.
export const getComponentDetails = tryCatch(async (req, res) => {
  const { serialNumber } = req.query;

  if (!serialNumber) {
    throw new AppError("Missing required query parameter: serialNumber", 400);
  }

  const query = `
    SELECT 
      d.Alias,
      a.PSNo,
      MATBM.Name AS [Model_Name],
      matb.Alias AS [Reference_Barcode],
      b.Serial AS [Component_Serial_Number],
      mat.Name AS [Component_Name],
      MatCat.Name AS [Component_Type],
      (SELECT Name FROM Ledger WHERE LedgerCode = mat.Ledger) AS Supplier_Name,
      b.ScannedOn,
      matb.Serial AS [Fg_Sr_No]
    FROM ProcessOrder a
    INNER JOIN ProcessInputBOMScan b ON a.PSNo = b.PSNo
    INNER JOIN ProcessInputBOM c ON c.PSNo = a.PSNo AND c.RowID = b.RowID
    INNER JOIN Material mat ON mat.MatCode = c.Material
    INNER JOIN ProdHeader d ON a.PRODNo = d.PRODNo
    INNER JOIN MaterialCategory MatCat ON MatCat.CategoryCode = mat.Category, MaterialBarcode matb
    LEFT JOIN Material MATBM ON MATBM.MatCode = matb.Material
    WHERE matb.DocNo = a.PSNo AND matb.Serial = @serial
    ORDER BY b.PSNo
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("serial", sql.VarChar, serialNumber)
      .query(query);

    if (!result.recordset.length) {
      throw new AppError(
        "No component details found for the given serial number",
        404
      );
    }

    res.status(200).json({
      success: true,
      message: "Component details retrieved successfully",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch component details: ${error.message}`,
      500
    );
  } finally {
    await pool.close();
  }
});
