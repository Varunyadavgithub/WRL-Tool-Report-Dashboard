// Plain global.pool3 data access for chat sessions/messages — kept separate
// from agent.js so the agent loop doesn't need to know any SQL.

export const createSession = async (userId, title) => {
  const result = await global.pool3.request()
    .input("userId", userId)
    .input("title", title || null)
    .query(`
      INSERT INTO ChatSessions (UserId, Title)
      OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.CreatedAt, INSERTED.UpdatedAt
      VALUES (@userId, @title)
    `);
  return result.recordset[0];
};

export const listSessions = async (userId) => {
  const result = await global.pool3.request()
    .input("userId", userId)
    .query(`
      SELECT Id, Title, CreatedAt, UpdatedAt
      FROM ChatSessions
      WHERE UserId = @userId
      ORDER BY UpdatedAt DESC
    `);
  return result.recordset;
};

export const getSessionById = async (sessionId) => {
  const result = await global.pool3.request()
    .input("sessionId", sessionId)
    .query(`SELECT Id, UserId, Title, CreatedAt, UpdatedAt FROM ChatSessions WHERE Id = @sessionId`);
  return result.recordset[0] || null;
};

export const getMessages = async (sessionId, limit = 50) => {
  const result = await global.pool3.request()
    .input("sessionId", sessionId)
    .input("limit", limit)
    .query(`
      SELECT TOP (@limit) Id, Role, Content, ToolCalls, CreatedAt
      FROM ChatMessages
      WHERE SessionId = @sessionId
      ORDER BY Id ASC
    `);
  return result.recordset;
};

export const appendMessage = async (sessionId, role, content, toolCalls = null) => {
  const result = await global.pool3.request()
    .input("sessionId", sessionId)
    .input("role", role)
    .input("content", content ?? null)
    .input("toolCalls", toolCalls ? JSON.stringify(toolCalls) : null)
    .query(`
      INSERT INTO ChatMessages (SessionId, Role, Content, ToolCalls)
      OUTPUT INSERTED.Id, INSERTED.CreatedAt
      VALUES (@sessionId, @role, @content, @toolCalls)
    `);
  await global.pool3.request()
    .input("sessionId", sessionId)
    .query(`UPDATE ChatSessions SET UpdatedAt = GETDATE() WHERE Id = @sessionId`);
  return result.recordset[0];
};
