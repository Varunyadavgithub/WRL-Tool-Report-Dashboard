import sql from "mssql";
import { dbConfig1 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";

// Helper function to convert to IST
const convertToIST = (date) => {
  return new Date(new Date(date).getTime() + 330 * 60000);
};

// Helper function to map testType to column name
const getTestResultColumn = (testType) => {
  const columnMap = {
    ect: "ect_result",
    hv: "hv_result",
    ir: "ir_result",
    lct: "lct_ln_result",
  };
  return columnMap[testType] || null;
};

// Helper function to get date ranges
const getDateRanges = {
  today: () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  },
  yesterday: () => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  },
  mtd: () => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  },
};

/**
 * @desc    Get EST Report data with filters
 * @route   GET /api/v1/est-report
 */
export const getEstReport = tryCatch(async (req, res) => {
  const {
    startDate,
    endDate,
    model,
    operator,
    result,
    testType,
    page = 1,
    limit = 100,
  } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build WHERE clause separately to reuse
  let whereClause = `WHERE date_time BETWEEN @startDate AND @endDate`;

  if (model) {
    whereClause += ` AND model_no = @model`;
  }
  if (operator) {
    whereClause += ` AND operator = @operator`;
  }
  if (result) {
    whereClause += ` AND result = @result`;
  }
  if (testType && testType !== "all") {
    const testResultColumn = getTestResultColumn(testType);
    if (testResultColumn) {
      whereClause += ` AND ${testResultColumn} = 'Fail'`;
    }
  }

  // Main data query
  const dataQuery = `
    SELECT 
      RefNo,
      model_no,
      serial_no,
      date_time,
      operator,
      set_ect_ohms,
      set_ect_time,
      read_ect_ohms,
      ect_result,
      set_hv_kv,
      set_hv_ma,
      set_hv_time,
      read_hv_kv,
      hv_result,
      set_ir_mohms,
      set_ir_time,
      read_ir_mohms,
      ir_result,
      set_lct_ma,
      set_lct_time,
      read_lct_ln_ma,
      read_lct_ln_Vtg,
      lct_ln_result,
      set_wattage_lower,
      set_wattage_upper,
      result,
      status
    FROM ESTStaging
    ${whereClause}
    ORDER BY date_time DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `;

  // Count query
  const countQuery = `
    SELECT COUNT(*) as total
    FROM ESTStaging
    ${whereClause}
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // Data request with all parameters
    const dataRequest = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, parseInt(limit));

    // Count request with same filter parameters
    const countRequest = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    // Add optional parameters to BOTH requests
    if (model) {
      dataRequest.input("model", sql.VarChar, model);
      countRequest.input("model", sql.VarChar, model);
    }
    if (operator) {
      dataRequest.input("operator", sql.VarChar, operator);
      countRequest.input("operator", sql.VarChar, operator);
    }
    if (result) {
      dataRequest.input("result", sql.VarChar, result);
      countRequest.input("result", sql.VarChar, result);
    }

    // Execute both queries
    const [dataResult, countResult] = await Promise.all([
      dataRequest.query(dataQuery),
      countRequest.query(countQuery),
    ]);

    const totalRecords = countResult.recordset[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    res.status(200).json({
      success: true,
      message: "EST Report data retrieved successfully.",
      data: dataResult.recordset,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch the EST Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get EST Report Summary
 * @route   GET /api/v1/est-report/summary
 */
export const getEstReportSummary = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE date_time BETWEEN @startDate AND @endDate`;
  if (model) {
    whereClause += ` AND model_no = @model`;
  }

  const query = `
    SELECT 
      COUNT(*) as totalTests,
      SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) as totalPass,
      SUM(CASE WHEN result = 'Fail' THEN 1 ELSE 0 END) as totalFail,
      SUM(CASE WHEN ect_result = 'Pass' THEN 1 ELSE 0 END) as ectPass,
      SUM(CASE WHEN ect_result = 'Fail' THEN 1 ELSE 0 END) as ectFail,
      SUM(CASE WHEN hv_result = 'Pass' THEN 1 ELSE 0 END) as hvPass,
      SUM(CASE WHEN hv_result = 'Fail' THEN 1 ELSE 0 END) as hvFail,
      SUM(CASE WHEN ir_result = 'Pass' THEN 1 ELSE 0 END) as irPass,
      SUM(CASE WHEN ir_result = 'Fail' THEN 1 ELSE 0 END) as irFail,
      SUM(CASE WHEN lct_ln_result = 'Pass' THEN 1 ELSE 0 END) as lctPass,
      SUM(CASE WHEN lct_ln_result = 'Fail' THEN 1 ELSE 0 END) as lctFail,
      COUNT(DISTINCT model_no) as uniqueModels,
      COUNT(DISTINCT operator) as uniqueOperators
    FROM ESTStaging
    ${whereClause}
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) {
      request.input("model", sql.VarChar, model);
    }

    const result = await request.query(query);
    const stats = result.recordset[0];
    const totalTests = stats.totalTests || 1;

    const summary = {
      total: {
        tests: stats.totalTests || 0,
        pass: stats.totalPass || 0,
        fail: stats.totalFail || 0,
        passRate: ((stats.totalPass / totalTests) * 100).toFixed(2),
      },
      ect: {
        pass: stats.ectPass || 0,
        fail: stats.ectFail || 0,
        passRate: ((stats.ectPass / totalTests) * 100).toFixed(2),
      },
      hv: {
        pass: stats.hvPass || 0,
        fail: stats.hvFail || 0,
        passRate: ((stats.hvPass / totalTests) * 100).toFixed(2),
      },
      ir: {
        pass: stats.irPass || 0,
        fail: stats.irFail || 0,
        passRate: ((stats.irPass / totalTests) * 100).toFixed(2),
      },
      lct: {
        pass: stats.lctPass || 0,
        fail: stats.lctFail || 0,
        passRate: ((stats.lctPass / totalTests) * 100).toFixed(2),
      },
      uniqueModels: stats.uniqueModels || 0,
      uniqueOperators: stats.uniqueOperators || 0,
    };

    res.status(200).json({
      success: true,
      message: "EST Report summary retrieved successfully.",
      data: summary,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch EST Report summary: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get distinct models
 * @route   GET /api/v1/est-report/models
 */
export const getDistinctModels = tryCatch(async (req, res) => {
  const query = `
    SELECT DISTINCT model_no
    FROM ESTStaging
    WHERE model_no IS NOT NULL AND model_no != ''
    ORDER BY model_no
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);
    const models = result.recordset.map((item) => ({
      label: item.model_no,
      value: item.model_no,
    }));

    res.status(200).json({
      success: true,
      message: "Models retrieved successfully.",
      data: models,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch models: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get distinct operators
 * @route   GET /api/v1/est-report/operators
 */
export const getDistinctOperators = tryCatch(async (req, res) => {
  const query = `
    SELECT DISTINCT operator
    FROM ESTStaging
    WHERE operator IS NOT NULL AND operator != ''
    ORDER BY operator
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool.request().query(query);
    const operators = result.recordset.map((item) => ({
      label: item.operator,
      value: item.operator,
    }));

    res.status(200).json({
      success: true,
      message: "Operators retrieved successfully.",
      data: operators,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch operators: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Quick filter (today, yesterday, mtd)
 * @route   GET /api/v1/est-report/quick/:filter
 */
export const getEstReportQuickFilter = tryCatch(async (req, res) => {
  const { filter } = req.params;
  const { model, operator, result } = req.query;

  if (!["today", "yesterday", "mtd"].includes(filter)) {
    throw new AppError(
      "Invalid filter. Use 'today', 'yesterday', or 'mtd'.",
      400,
    );
  }

  const { start, end } = getDateRanges[filter]();
  const istStart = convertToIST(start);
  const istEnd = convertToIST(end);

  let whereClause = `WHERE date_time BETWEEN @startDate AND @endDate`;

  if (model) whereClause += ` AND model_no = @model`;
  if (operator) whereClause += ` AND operator = @operator`;
  if (result) whereClause += ` AND result = @result`;

  const query = `
    SELECT 
      RefNo, model_no, serial_no, date_time, operator,
      set_ect_ohms, set_ect_time, read_ect_ohms, ect_result,
      set_hv_kv, set_hv_ma, set_hv_time, read_hv_kv, hv_result,
      set_ir_mohms, set_ir_time, read_ir_mohms, ir_result,
      set_lct_ma, set_lct_time, read_lct_ln_ma, read_lct_ln_Vtg, lct_ln_result,
      set_wattage_lower, set_wattage_upper, result, status
    FROM ESTStaging
    ${whereClause}
    ORDER BY date_time DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);
    if (operator) request.input("operator", sql.VarChar, operator);
    if (result) request.input("result", sql.VarChar, result);

    const dataResult = await request.query(query);

    res.status(200).json({
      success: true,
      message: `EST Report data for ${filter} retrieved successfully.`,
      filter,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      count: dataResult.recordset.length,
      data: dataResult.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch EST Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get EST Report by RefNo
 * @route   GET /api/v1/est-report/:refNo
 */
export const getEstReportByRefNo = tryCatch(async (req, res) => {
  const { refNo } = req.params;

  if (!refNo) {
    throw new AppError("RefNo is required.", 400);
  }

  const query = `SELECT * FROM ESTStaging WHERE RefNo = @refNo`;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("refNo", sql.Int, parseInt(refNo))
      .query(query);

    if (result.recordset.length === 0) {
      throw new AppError(`No record found with RefNo: ${refNo}`, 404);
    }

    res.status(200).json({
      success: true,
      message: "EST Report record retrieved successfully.",
      data: result.recordset[0],
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to fetch EST Report record: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Export EST Report
 * @route   GET /api/v1/est-report/export
 */
export const exportEstReport = tryCatch(async (req, res) => {
  const { startDate, endDate, model, operator, result } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE date_time BETWEEN @startDate AND @endDate`;

  if (model) whereClause += ` AND model_no = @model`;
  if (operator) whereClause += ` AND operator = @operator`;
  if (result) whereClause += ` AND result = @result`;

  const query = `
    SELECT 
      RefNo,
      model_no AS 'Model Number',
      serial_no AS 'Serial Number',
      date_time AS 'Date Time',
      operator AS 'Operator',
      set_ect_ohms AS 'ECT Set (Ohms)',
      set_ect_time AS 'ECT Time',
      read_ect_ohms AS 'ECT Read (Ohms)',
      ect_result AS 'ECT Result',
      set_hv_kv AS 'HV Set (kV)',
      set_hv_ma AS 'HV Set (mA)',
      set_hv_time AS 'HV Time',
      read_hv_kv AS 'HV Read (kV)',
      hv_result AS 'HV Result',
      set_ir_mohms AS 'IR Set (MOhms)',
      set_ir_time AS 'IR Time',
      read_ir_mohms AS 'IR Read (MOhms)',
      ir_result AS 'IR Result',
      set_lct_ma AS 'LCT Set (mA)',
      set_lct_time AS 'LCT Time',
      read_lct_ln_ma AS 'LCT Read (mA)',
      read_lct_ln_Vtg AS 'LCT Voltage',
      lct_ln_result AS 'LCT Result',
      set_wattage_lower AS 'Wattage Lower',
      set_wattage_upper AS 'Wattage Upper',
      result AS 'Overall Result',
      status AS 'Status'
    FROM ESTStaging
    ${whereClause}
    ORDER BY date_time DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);
    if (operator) request.input("operator", sql.VarChar, operator);
    if (result) request.input("result", sql.VarChar, result);

    const dataResult = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Export data retrieved successfully.",
      count: dataResult.recordset.length,
      data: dataResult.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to export EST Report data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get model-wise statistics
 * @route   GET /api/v1/est-report/model-stats
 */
export const getModelWiseStats = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const query = `
    SELECT 
      model_no,
      COUNT(*) as totalTests,
      SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN result = 'Fail' THEN 1 ELSE 0 END) as failCount,
      CAST(SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as passRate
    FROM ESTStaging
    WHERE date_time BETWEEN @startDate AND @endDate
    GROUP BY model_no
    ORDER BY totalTests DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Model-wise statistics retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch model-wise statistics: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get operator-wise statistics
 * @route   GET /api/v1/est-report/operator-stats
 */
export const getOperatorWiseStats = tryCatch(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  const query = `
    SELECT 
      operator,
      COUNT(*) as totalTests,
      SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN result = 'Fail' THEN 1 ELSE 0 END) as failCount,
      CAST(SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as passRate
    FROM ESTStaging
    WHERE date_time BETWEEN @startDate AND @endDate
    GROUP BY operator
    ORDER BY totalTests DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const result = await pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd)
      .query(query);

    res.status(200).json({
      success: true,
      message: "Operator-wise statistics retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch operator-wise statistics: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get hourly trend
 * @route   GET /api/v1/est-report/hourly-trend
 */
export const getHourlyTrend = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE date_time BETWEEN @startDate AND @endDate`;
  if (model) whereClause += ` AND model_no = @model`;

  const query = `
    SELECT 
      DATEPART(HOUR, date_time) as hour,
      COUNT(*) as totalTests,
      SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN result = 'Fail' THEN 1 ELSE 0 END) as failCount
    FROM ESTStaging
    ${whereClause}
    GROUP BY DATEPART(HOUR, date_time)
    ORDER BY hour
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Hourly trend data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch hourly trend data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get daily trend
 * @route   GET /api/v1/est-report/daily-trend
 */
export const getDailyTrend = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE date_time BETWEEN @startDate AND @endDate`;
  if (model) whereClause += ` AND model_no = @model`;

  const query = `
    SELECT 
      CAST(date_time AS DATE) as date,
      COUNT(*) as totalTests,
      SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) as passCount,
      SUM(CASE WHEN result = 'Fail' THEN 1 ELSE 0 END) as failCount,
      CAST(SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as passRate
    FROM ESTStaging
    ${whereClause}
    GROUP BY CAST(date_time AS DATE)
    ORDER BY date
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Daily trend data retrieved successfully.",
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch daily trend data: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get failed tests
 * @route   GET /api/v1/est-report/failures
 */
export const getFailedTests = tryCatch(async (req, res) => {
  const { startDate, endDate, testType, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE date_time BETWEEN @startDate AND @endDate AND result = 'Fail'`;

  if (model) whereClause += ` AND model_no = @model`;

  if (testType && testType !== "all") {
    const testColumn = getTestResultColumn(testType);
    if (testColumn) {
      whereClause += ` AND ${testColumn} = 'Fail'`;
    }
  }

  const query = `
    SELECT 
      RefNo, model_no, serial_no, date_time, operator,
      ect_result, hv_result, ir_result, lct_ln_result, result
    FROM ESTStaging
    ${whereClause}
    ORDER BY date_time DESC
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Failed tests retrieved successfully.",
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    throw new AppError(`Failed to fetch failed tests: ${error.message}`, 500);
  } finally {
    await pool.close();
  }
});

/**
 * @desc    Get failure analysis
 * @route   GET /api/v1/est-report/failure-analysis
 */
export const getFailureAnalysis = tryCatch(async (req, res) => {
  const { startDate, endDate, model } = req.query;

  if (!startDate || !endDate) {
    throw new AppError(
      "Missing required query parameters: startDate or endDate.",
      400,
    );
  }

  const istStart = convertToIST(startDate);
  const istEnd = convertToIST(endDate);

  let whereClause = `WHERE date_time BETWEEN @startDate AND @endDate`;
  if (model) whereClause += ` AND model_no = @model`;

  const query = `
    SELECT 
      'ECT' as testType,
      SUM(CASE WHEN ect_result = 'Fail' THEN 1 ELSE 0 END) as failCount,
      COUNT(*) as totalCount
    FROM ESTStaging ${whereClause}
    UNION ALL
    SELECT 
      'HV' as testType,
      SUM(CASE WHEN hv_result = 'Fail' THEN 1 ELSE 0 END) as failCount,
      COUNT(*) as totalCount
    FROM ESTStaging ${whereClause}
    UNION ALL
    SELECT 
      'IR' as testType,
      SUM(CASE WHEN ir_result = 'Fail' THEN 1 ELSE 0 END) as failCount,
      COUNT(*) as totalCount
    FROM ESTStaging ${whereClause}
    UNION ALL
    SELECT 
      'LCT' as testType,
      SUM(CASE WHEN lct_ln_result = 'Fail' THEN 1 ELSE 0 END) as failCount,
      COUNT(*) as totalCount
    FROM ESTStaging ${whereClause}
  `;

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    const request = pool
      .request()
      .input("startDate", sql.DateTime, istStart)
      .input("endDate", sql.DateTime, istEnd);

    if (model) request.input("model", sql.VarChar, model);

    const result = await request.query(query);

    const analysis = result.recordset.map((item) => ({
      testType: item.testType,
      failCount: item.failCount || 0,
      totalCount: item.totalCount || 0,
      failRate:
        item.totalCount > 0
          ? ((item.failCount / item.totalCount) * 100).toFixed(2)
          : "0.00",
    }));

    res.status(200).json({
      success: true,
      message: "Failure analysis retrieved successfully.",
      data: analysis,
    });
  } catch (error) {
    throw new AppError(
      `Failed to fetch failure analysis: ${error.message}`,
      500,
    );
  } finally {
    await pool.close();
  }
});
