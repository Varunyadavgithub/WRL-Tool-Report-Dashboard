import sql from "mssql";
import jwt from "jsonwebtoken";
import { dbConfig1 } from "../config/db.js";
import { tryCatch } from "../config/tryCatch.js";
import { AppError } from "../utils/AppError.js";

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
        SELECT 
          U.UserCode, 
          U.UserName, 
          U.UserID, 
          U.Password, 
          U.UserRole, 
          R.RoleName 
        FROM Users U
        JOIN UserRoles R ON U.UserRole = R.RoleCode
        WHERE U.UserID = @empcod AND U.Password = @password
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
    { expiresIn: "1d" }
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
