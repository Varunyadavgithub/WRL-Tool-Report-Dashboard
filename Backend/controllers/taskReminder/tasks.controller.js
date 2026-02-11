import sql from "mssql";
import { dbConfig3 } from "../../config/db.config.js";
import { tryCatch } from "../../utils/tryCatch.js";
import { AppError } from "../../utils/AppError.js";
import { sendTaskReminderMail } from "../../emailTemplates/Task_Reminder_System/createTaskReminder.template.js";
import { sendTaskCompletedMail } from "../../emailTemplates/Task_Reminder_System/taskCompleted.template.js";

// CREATE A NEW TASK
export const createTask = tryCatch(async (req, res) => {
  const {
    title,
    description,
    assignedTo,
    department,
    priority,
    dueDate,
    reminderCount,
  } = req.body;

  if (!title || !assignedTo || !priority || !dueDate) {
    throw new AppError(
      "Required fields: title, assignedTo, priority, dueDate",
      400,
    );
  }

  const taskPool = await new sql.ConnectionPool(dbConfig3).connect();
  const userPool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    // Insert Task
    const insertQuery = `
      INSERT INTO dbo.Tasks
      (Title, Description, AssignedTo, CreatedBy, Department, Priority, Status, DueDate, ReminderCount, CreatedAt, UpdatedAt)
      VALUES
      (@title, @description, @assignedTo, @createdBy, @department, @priority, @status, @dueDate, @reminderCount, GETDATE(), GETDATE())
    `;

    const taskResult = await taskPool
      .request()
      .input("title", sql.VarChar(200), title)
      .input("description", sql.VarChar(sql.MAX), description || "")
      .input("assignedTo", sql.VarChar(50), assignedTo)
      .input("createdBy", sql.VarChar(50), req.user?.id || "SYSTEM")
      .input("department", sql.VarChar(100), department || "")
      .input("priority", sql.VarChar(20), priority)
      .input("status", sql.VarChar(20), "Open")
      .input("dueDate", sql.DateTime, new Date(dueDate))
      .input("reminderCount", sql.Int, Number(reminderCount) || 0)
      .query(insertQuery);

    const created = taskResult.recordset[0];

    // Fetch user email
    const userResult = await userPool
      .request()
      .input("assignedTo", sql.VarChar(50), assignedTo)
      .query(
        `SELECT employee_email, name FROM Users WHERE employee_id = @assignedTo`,
      );

    if (userResult.recordset.length === 0) {
      console.warn("No email found for:", assignedTo);
    } else {
      const assignedUserEmail = userResult.recordset[0];

      // Send email (non-blocking)
      sendTaskReminderMail({
        assignedTo: assignedUserEmail.employee_email,
        assignedUserName: assignedUserEmail.name,
        title: created.Title,
        description: created.Description,
        department: created.Department,
        priority: created.Priority,
        dueDate: created.DueDate,
        reminderCount: created.ReminderCount,
        status: created.status,
      }).catch((err) => console.error("Initial task email failed:", err));
    }

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: created,
    });
  } catch (error) {
    throw new AppError(`Failed to create task: ${error.message}`, 500);
  } finally {
    await taskPool.close();
    await userPool.close();
  }
});

// GET LIST OF ALL TASKS
export const getTasks = tryCatch(async (req, res) => {
  const taskPool = await new sql.ConnectionPool(dbConfig3).connect();
  const userPool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    // Fetch tasks
    const taskResult = await taskPool.request().query(`
      SELECT
        TaskId,
        Title,
        Description,
        AssignedTo AS employee_id,
        Department,
        Priority,
        Status,
        DueDate,
        ReminderCount,
        CreatedAt,
        UpdatedAt
      FROM Tasks
      ORDER BY CreatedAt DESC
    `);

    const tasks = taskResult.recordset;

    // Get unique employee IDs
    const employeeIds = [
      ...new Set(tasks.map((t) => t.employee_id).filter(Boolean)),
    ];

    if (employeeIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Tasks fetched successfully",
        data: tasks,
      });
    }

    // Fetch users from OTHER DB
    const userResult = await userPool.request().query(`
      SELECT employee_id, name
      FROM Users
      WHERE employee_id IN (${employeeIds.map((id) => `'${id}'`).join(",")})
    `);

    const userMap = {};
    userResult.recordset.forEach((u) => {
      userMap[u.employee_id] = u.name;
    });

    // Merge user names into tasks
    const enrichedTasks = tasks.map((task) => ({
      ...task,
      employee_name: userMap[task.employee_id] || null,
    }));

    res.status(200).json({
      success: true,
      message: "Tasks fetched successfully",
      data: enrichedTasks,
    });
  } catch (err) {
    console.error("Get tasks error:", err);
    throw new AppError("Failed to fetch tasks", 500);
  } finally {
    await taskPool.close();
    await userPool.close();
  }
});

export const updateTaskStatus = tryCatch(async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;

  if (!taskId || !status) {
    throw new AppError("Task ID and status are required", 400);
  }

  const pool = await new sql.ConnectionPool(dbConfig3).connect();
  const userPool = await new sql.ConnectionPool(dbConfig3).connect();

  try {
    // Update the task status and return the updated row
    const updateQuery = `
      DECLARE @UpdatedTasks TABLE (
        TaskId INT,
        Title VARCHAR(200),
        Description VARCHAR(MAX),
        AssignedTo VARCHAR(50),
        Department VARCHAR(100),
        Priority VARCHAR(20),
        Status VARCHAR(20),
        DueDate DATETIME,
        ReminderCount INT
      );

      UPDATE dbo.Tasks
      SET Status = @status, UpdatedAt = GETDATE()
      OUTPUT INSERTED.TaskId, INSERTED.Title, INSERTED.Description, INSERTED.AssignedTo,
             INSERTED.Department, INSERTED.Priority, INSERTED.Status,
             INSERTED.DueDate, INSERTED.ReminderCount
      INTO @UpdatedTasks
      WHERE TaskId = @taskId;

      SELECT * FROM @UpdatedTasks;
    `;

    const result = await pool
      .request()
      .input("status", sql.VarChar(50), status)
      .input("taskId", sql.Int, taskId)
      .query(updateQuery);

    const updatedTask = result.recordset?.[0];

    if (!updatedTask) {
      throw new AppError("Task not found", 404);
    }

    // Send email if status is Completed
    if (status === "Completed") {
      const userResult = await userPool
        .request()
        .input("assignedTo", sql.VarChar(50), updatedTask.AssignedTo)
        .query(
          `SELECT employee_email, name FROM Users WHERE employee_id = @assignedTo`,
        );

      const assignedUser = userResult.recordset?.[0];

      if (assignedUser) {
        sendTaskCompletedMail({
          assignedTo: assignedUser.employee_email,
          assignedUserName: assignedUser.name,
          title: updatedTask.Title,
          description: updatedTask.Description,
          department: updatedTask.Department,
          priority: updatedTask.Priority,
          dueDate: updatedTask.DueDate,
          reminderCount: updatedTask.ReminderCount,
          status: updatedTask.Status,
        }).catch((err) => console.error("Email sending failed:", err));
      }
    }

    res.status(200).json({
      success: true,
      message: "Task status updated",
      data: updatedTask,
    });
  } catch (err) {
    throw new AppError(`Failed to update task: ${err.message}`, 500);
  } finally {
    await pool.close();
    await userPool.close();
  }
});
