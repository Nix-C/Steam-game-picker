import { Database } from "sqlite3";

export const userData = new Database("./userData.db", (err) => {
  if (err) {
    console.error("(SQLite 🪶) Could not connect to userData ");
  } else {
    console.log("(SQLite 🪶) Connected to userData ");
  }
});
