import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

// Config for Server 1
export const dbConfig1 = {
  user: process.env.DB_USER1,
  password: process.env.DB_PASSWORD1,
  server: process.env.DB_SERVER1,
  database: process.env.DB_NAME1,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Config for Server 2
export const dbConfig2 = {
  user: process.env.DB_USER2,
  password: process.env.DB_PASSWORD2,
  server: process.env.DB_SERVER2,
  database: process.env.DB_NAME2,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Config for Server 3
export const dbConfig3 = {
  user: process.env.DB_USER3,
  password: process.env.DB_PASSWORD3,
  server: process.env.DB_SERVER3,
  database: process.env.DB_NAME3,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Function to connect to any given config
export const connectToDB = async (dbConfig) => {
  try {
    const pool = await sql.connect(dbConfig);
    console.log(`Connected to SQL Server: ${dbConfig.server}`);
    return pool;
  } catch (err) {
    console.error(
      `Database connection failed for server ${dbConfig.server}:`,
      err
    );
    throw err;
  }
};

export default sql;