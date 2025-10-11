import sql, { dbConfig1 } from "../../config/db.js";

export const generateReport = async (req, res) => {
  const { startTime, endTime, model, page = 1, limit = 100 } = req.query;

  if (!startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: "startTime and endTime are required",
    });
  }

  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit));

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    }

    const query = `
WITH Bommaterials AS (
    SELECT psno, BOMCode, RowID, Material, Qty, ConsumedQty
    FROM ProcessInputBOM

    UNION ALL

    SELECT 
        a.psno, 
        a.BOMCode, 
        a.RowID, 
        b.Material, 
        NULL AS Qty, 
        NULL AS ConsumedQty
    FROM ProcessInputBOM a
    INNER JOIN BOMInputAltMaterial b 
        ON a.RowID = b.RowID 
        AND a.BOMCode = b.BOMCode
)
SELECT 
    a.PSNo,
    MATBM.Name AS Model_Name,
    b.Serial AS Component_Serial_Number,
    mat.Name AS Component_Name,
    MatCat.Name AS Component_Type,
    L.Name AS Supplier_Name,
    b.ScannedOn AS Comp_ScanedOn,
    pa.ActivityOn AS FG_Date,
    MATB.Serial AS Fg_Sr_No,
    MATB.VSerial AS Asset_tag,
    mat.AltName AS SAP_Item_Code
FROM ProcessOrder a
INNER JOIN ProcessInputBOMScan b 
    ON a.PSNo = b.PSNo
INNER JOIN Bommaterials c 
    ON c.PSNo = a.PSNo 
    AND c.RowID = b.RowID 
    AND c.Material = b.Material
INNER JOIN Material mat 
    ON mat.MatCode = c.Material
INNER JOIN ProdHeader d 
    ON a.PRODNo = d.PRODNo
INNER JOIN MaterialCategory MatCat 
    ON MatCat.CategoryCode = mat.Category
INNER JOIN MaterialBarcode MATB 
    ON MATB.DocNo = a.PSNo
INNER JOIN ProcessActivity pa 
    ON pa.PSNo = a.PSNo 
    AND pa.ActivityType = 5 
    AND pa.StationCode IN (1220010, 1230017)
    AND pa.ActivityOn BETWEEN @startTime AND @endTime
LEFT JOIN Material MATBM 
    ON MATBM.MatCode = MATB.Material
LEFT JOIN Ledger L 
    ON L.LedgerCode = mat.Ledger
WHERE 
    MATB.status <> 99
    AND MATB.VSerial IS NOT NULL
        ${model && model !== "0" ? "AND MATBM.MatCode = @model" : ""}
      ORDER BY a.PSNo
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const result = await request.query(query);

    const data = result.recordset;
    const totalCount = data.length > 0 ? data[0].totalCount : 0;

    res.status(200).json({
      success: true,
      data,
      totalCount,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Export Data
export const fetchExportData = async (req, res) => {
  const { startTime, endTime, model } = req.query;

  if (!startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: "startTime and endTime are required",
    });
  }

  try {
    const istStart = new Date(new Date(startTime).getTime() + 330 * 60000);
    const istEnd = new Date(new Date(endTime).getTime() + 330 * 60000);

    let query = `
        WITH Bommaterials AS (
            SELECT psno, BOMCode, RowID, Material, Qty, ConsumedQty
            FROM ProcessInputBOM

            UNION ALL

            SELECT 
                a.psno, 
                a.BOMCode, 
                a.RowID, 
                b.Material, 
                NULL AS Qty, 
                NULL AS ConsumedQty
            FROM ProcessInputBOM a
            INNER JOIN BOMInputAltMaterial b 
                ON a.RowID = b.RowID 
                AND a.BOMCode = b.BOMCode
        )
        SELECT 
            a.PSNo,
            MATBM.Name AS Model_Name,
            b.Serial AS Component_Serial_Number,
            mat.Name AS Component_Name,
            MatCat.Name AS Component_Type,
            L.Name AS Supplier_Name,
            b.ScannedOn AS Comp_ScanedOn,
            pa.ActivityOn AS FG_Date,
            MATB.Serial AS Fg_Sr_No,
            MATB.VSerial AS Asset_tag,
            mat.AltName AS SAP_Item_Code
        FROM ProcessOrder a
        INNER JOIN ProcessInputBOMScan b 
            ON a.PSNo = b.PSNo
        INNER JOIN Bommaterials c 
            ON c.PSNo = a.PSNo 
            AND c.RowID = b.RowID 
            AND c.Material = b.Material
        INNER JOIN Material mat 
            ON mat.MatCode = c.Material
        INNER JOIN ProdHeader d 
            ON a.PRODNo = d.PRODNo
        INNER JOIN MaterialCategory MatCat 
            ON MatCat.CategoryCode = mat.Category
        INNER JOIN MaterialBarcode MATB 
            ON MATB.DocNo = a.PSNo
        INNER JOIN ProcessActivity pa 
            ON pa.PSNo = a.PSNo 
            AND pa.ActivityType = 5 
            AND pa.StationCode IN (1220010, 1230017)
            AND pa.ActivityOn BETWEEN @startTime AND @endTime
        LEFT JOIN Material MATBM 
            ON MATBM.MatCode = MATB.Material
        LEFT JOIN Ledger L 
            ON L.LedgerCode = mat.Ledger
        WHERE 
            MATB.status <> 99
            AND MATB.VSerial IS NOT NULL
    `;

    if (model && model !== "0") {
      query += ` AND MATBM.MatCode = @model`;
    }

    query += " ORDER BY a.PSNo;";

    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const request = pool
      .request()
      .input("startTime", sql.DateTime, istStart)
      .input("endTime", sql.DateTime, istEnd);

    if (model && model !== "0") {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      result: result.recordset,
    });

    await pool.close();
  } catch (err) {
    console.error("SQL Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};