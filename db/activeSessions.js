import sqlite3 from "sqlite3";

export class ActiveSessions {
  constructor() {
    // Singleton check
    if (ActiveSessions.instance) {
      console.warn("An instance of ActiveSessions already exists!");
      return ActiveSessions.instance;
    }

    this.db = new sqlite3.Database("./active_sessions.db", (err) => {
      if (err) {
        console.error("(SQLite 🪶 ) Could not connect to active_sessions");
      } else {
        console.log("(SQLite 🪶 ) Connected to active_sessions");
      }
    });
    ActiveSessions.instance = this;
  }
}
