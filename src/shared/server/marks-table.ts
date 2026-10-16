export const createMarksTableSql = `
  CREATE TABLE IF NOT EXISTS marks (
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    state TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, code)
  )
`;
