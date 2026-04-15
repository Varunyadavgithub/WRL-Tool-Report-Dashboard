import sql from "mssql";
// import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { dbConfig1 } from "../config/db.config.js";
import { tryCatch } from "../utils/tryCatch.js";
import { AppError } from "../utils/AppError.js";

// Handles user signup by validating input, generating a unique UserCode, hashing the password, inserting the user into the database, and returning a JWT token.
export const signup = tryCatch(async (req, res) => {
  const { empcod, username, password, userRole } = req.body;

  if (!empcod || !username || !password || !userRole) {
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
    const idMaster = await pool.request().query(`
      SELECT * FROM IDMaster WHERE IDTable = 'USERS'
    `);

    const series = idMaster.recordset[0].Series;

    // 3. Get current year
    const year = new Date().getFullYear().toString().slice(-2);

    // 4. Get current SLNo
    const idValue = await pool.request().input("year", sql.VarChar, year)
      .query(`
        SELECT SLNo FROM IDValue 
        WHERE IDTable = 'USERS' AND Year = @year
      `);

    let slno = idValue.recordset.length ? idValue.recordset[0].SLNo + 1 : 1;

    // 5. Update IDValue
    await pool
      .request()
      .input("year", sql.VarChar, year)
      .input("slno", sql.Int, slno).query(`
        IF EXISTS (SELECT 1 FROM IDValue WHERE IDTable='USERS' AND Year=@year)
          UPDATE IDValue SET SLNo=@slno WHERE IDTable='USERS' AND Year=@year
        ELSE
          INSERT INTO IDValue (IDTable, Year, SLNo)
          VALUES ('USERS', @year, @slno)
      `);

    // 6. Generate UserCode
    const userCode = series + year + String(slno).padStart(3, "0");

    // 7. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 8. Insert user
    await pool
      .request()
      .input("UserCode", sql.VarChar, userCode)
      .input("UserID", sql.VarChar, empcod)
      .input("UserName", sql.VarChar, username)
      .input("Password", sql.VarChar, hashedPassword)
      .input("UserRole", sql.VarChar, userRole).query(`
        INSERT INTO Users (
          UserCode, UserID, UserName, Password, UserRole,
          LastActivityOn, LastPwChOn, WrongPw, Locked, SystemUser, Status
        )
        VALUES (
          @UserCode, @UserID, @UserName, @Password, @UserRole,
          GETDATE(), GETDATE(), 0, 0, 0, 1
        )
      `);

    // 9. Optional JWT login after signup
    const token = jwt.sign(
      {
        id: empcod,
        name: username,
        usercode: userCode,
        role: userRole,
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

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        usercode: userCode,
        id: empcod,
        name: username,
        role: userRole,
      },
    });
  } finally {
    await pool.close();
  }
});

// Handles user login by verifying credentials and issuing a JWT token.
export const login = tryCatch(async (req, res) => {
  const { empcod, password } = req.body;

  if (!empcod || !password) {
    throw new AppError("Employee code and password are required.", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig1).connect();

  let result;
  try {
    result = await pool
      .request()
      .input("empcod", sql.VarChar, empcod)
      .input("password", sql.VarChar, password).query(`
        Select 
          U.UserCode, 
          U.UserName, 
          U.UserID, 
          U.Password, 
          U.UserRole, 
          R.RoleName 
        From Users U
        JOIN UserRoles R ON U.UserRole = R.RoleCode
        Where U.UserID = @empcod AND U.Password = @password
      `);
  } finally {
    await pool.close();
  }

  const user = result.recordset[0];

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

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
});

// Handles user logout by clearing the JWT token cookie.
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
