import sql, { dbConfig1 } from "../../config/db.js";

export const getComponentDetails = async (req, res) => {
  const { serialNumber } = req.query;

  if (!serialNumber) {
    return res
      .status(400)
      .send("Missing required query parameter: serialNumber");
  }

  try {
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
      INNER JOIN MaterialCategory MatCat ON MatCat.CategoryCode = mat.Category
      , MaterialBarcode matb
      LEFT JOIN Material MATBM ON MATBM.MatCode = matb.Material
      WHERE matb.DocNo = a.PSNo AND matb.Serial = @serial
      ORDER BY b.PSNo
    `;
    const pool = await new sql.ConnectionPool(dbConfig1).connect();

    const result = await pool
      .request()
      .input("serial", sql.VarChar, serialNumber)
      .query(query);

    res.status(200).json(result.recordset);
    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};