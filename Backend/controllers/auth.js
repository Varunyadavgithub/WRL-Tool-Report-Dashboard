import sql from "mssql";
import jwt from "jsonwebtoken";
import { dbConfig1 } from "../config/db.js";

export const login = async (req, res) => {
  const { empcod, password } = req.body;

  if (!empcod || !password) {
    return res.status(400).json({
      success: false,
      message: "Employee code and password are required.",
    });
  }

  try {
    const pool = await new sql.ConnectionPool(dbConfig1).connect();
    const result = await pool
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
        FROM 
          Users U
        JOIN 
          UserRoles R ON U.UserRole = R.RoleCode
        WHERE 
          U.UserID = @empcod AND U.Password = @password
  `);
    await pool.close();

    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // ✅ Create JWT token
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

    // ✅ Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // ✅ Send response
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
  } catch (error) {
    console.error("SQL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const logout = async (_, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};
