import sql from "mssql";
import jwt from "jsonwebtoken";
import { dbConfig1 } from "../config/db.config.js";
import { tryCatch } from "../utils/tryCatch.js";
import { AppError } from "../utils/AppError.js";

// ================= SIGNUP =================
export const signup = tryCatch(async (req, res) => {
  const { empcod, username, password } = req.body;

  if (!empcod || !username || !password) {
    throw new AppError("All fields are required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // 1. Check duplicate user
    const existing = await pool
      .request()
      .input("empcod", sql.VarChar, empcod)
      .query(`SELECT 1 FROM Users WHERE UserID = @empcod`);

    if (existing.recordset.length > 0) {
      throw new AppError("User already exists", 409);
    }

    // 2. Get IDMaster config
    const idMasterRes = await pool.request().query(`
      SELECT Series, NoOfDigit 
      FROM IDMaster 
      WHERE IDTable = 'USERS'
    `);

    if (idMasterRes.recordset.length === 0) {
      throw new AppError("IDMaster config missing", 500);
    }

    let { Series, NoOfDigit } = idMasterRes.recordset[0];

    // 3. Current year (last 2 digits)
    const year = new Date().getFullYear().toString().slice(-2);

    // 4. Get SLNo from IDValue
    const idValueRes = await pool.request().input("year", sql.VarChar, year)
      .query(`
        SELECT SLNo 
        FROM IDValue 
        WHERE IDTable = 'USERS' AND Year = @year
      `);

    let slno = 1;

    if (idValueRes.recordset.length > 0) {
      slno = idValueRes.recordset[0].SLNo + 1;
    }

    // 5. Check overflow (999)
    const maxLimit = Math.pow(10, NoOfDigit) - 1; // 999

    if (slno > maxLimit) {
      // Increase Series
      Series = Series + 1;

      // Reset SLNo
      slno = 1;

      // Update Series in IDMaster
      await pool.request().input("series", sql.Int, Series).query(`
          UPDATE IDMaster 
          SET Series = @series 
          WHERE IDTable = 'USERS'
        `);
    }

    // 6. Update IDValue table
    await pool
      .request()
      .input("year", sql.VarChar, year)
      .input("slno", sql.Int, slno).query(`
        IF EXISTS (
          SELECT 1 FROM IDValue 
          WHERE IDTable = 'USERS' AND Year = @year
        )
          UPDATE IDValue 
          SET SLNo = @slno 
          WHERE IDTable = 'USERS' AND Year = @year
        ELSE
          INSERT INTO IDValue (IDTable, Year, SLNo)
          VALUES ('USERS', @year, @slno)
      `);

    // 7. Generate UserCode
    const padded = String(slno).padStart(NoOfDigit, "0");
    const userCode = `${Series}${year}${padded}`;

    // 8. Insert user (inactive)
    await pool
      .request()
      .input("UserCode", sql.VarChar, userCode)
      .input("UserID", sql.VarChar, empcod)
      .input("UserName", sql.VarChar, username)
      .input("Password", sql.VarChar, password).query(`
        INSERT INTO Users (
          UserCode,
          UserID,
          UserName,
          Password,
          UserRole,
          Employee,
          LastActivityOn,
          LastPwChOn,
          WrongPw,
          Photo,
          Locked,
          DefaultForm,
          SystemUser,
          Status
        )
        VALUES (
          @UserCode,
          @UserID,
          @UserName,
          @Password,
          223009,
          NULL,
          NULL,
          GETDATE(),
          0,
          NULL,
          0,
          0,
          0,
          200
        )
      `);

    res.status(201).json({
      success: true,
      message: "Signup successful. Wait for admin approval.",
      usercode: userCode,
    });
  } finally {
    await pool.close();
  }
});

// ================= LOGIN =================
export const login = tryCatch(async (req, res) => {
  const { empcod, password } = req.body;

  if (!empcod || !password) {
    throw new AppError("Employee code and password are required.", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  try {
    // 1. Check user
    const checkUser = await pool.request().input("empcod", sql.VarChar, empcod)
      .query(`
        SELECT UserID, Status, Locked 
        FROM Users 
        WHERE UserID = @empcod
      `);

    if (checkUser.recordset.length === 0) {
      throw new AppError("User not found", 404);
    }

    const { Status, Locked } = checkUser.recordset[0];

    if (Status !== 1) {
      throw new AppError("Account not activated. Contact admin.", 403);
    }

    if (Locked === 1) {
      throw new AppError("Account is locked", 403);
    }

    // 2. Validate password
    const result = await pool
      .request()
      .input("empcod", sql.VarChar, empcod)
      .input("password", sql.VarChar, password).query(`
        SELECT 
          U.UserCode, 
          U.UserName, 
          U.UserID, 
          U.UserRole, 
          R.RoleName 
        FROM Users U
        JOIN UserRoles R ON U.UserRole = R.RoleCode
        WHERE U.UserID = @empcod AND U.Password = @password
      `);

    const user = result.recordset[0];

    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    // 3. Update last activity
    await pool.request().input("empcod", sql.VarChar, empcod).query(`
        UPDATE Users 
        SET LastActivityOn = GETDATE()
        WHERE UserID = @empcod
      `);

    // 4. JWT
    const token = jwt.sign(
      {
        id: user.UserID,
        name: user.UserName,
        usercode: user.UserCode,
        role: user.UserRole,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.UserID,
        name: user.UserName,
        usercode: user.UserCode,
        role: user.RoleName.toLowerCase(),
      },
    });
  } finally {
    await pool.close();
  }
});

// ================= LOGOUT =================
export const logout = tryCatch(async (_, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
