import { Database } from "sqlite3";

export const activeSessions = new Database("./activeSessions.db", (err) => {
  if (err) {
    console.error("(SQLite 🪶) Could not connect to activeSessions ");
  } else {
    console.log("(SQLite 🪶) Connected to activeSessions ");
  }
});
