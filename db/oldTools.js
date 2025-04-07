import sqlite3 from "sqlite3";

const DB_NAME = "steam_game_picker";
const TABLE_NAME = "user_data";

export class UserData {
  constructor() {
    // Singleton check
    if (UserData.instance) {
      console.warn("An instance of user_data already exists!");
      return UserData.instance;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      this.db = new sqlite3.Database("./" + DB_NAME + ".db", (err) => {
        if (err) {
          console.error("(SQLite 🪶 ) Could not connect to", DB_NAME);
          return reject(err);
        } else {
          console.log("(SQLite 🪶 ) Connected to", DB_NAME);
          resolve(this.db);
        }
      });
    });

    UserData.instance = this;
  }

  async test() {
    await this.dbPromise; // Wait for DB to initialize before commands
    console.log("Hello from", TABLE_NAME);
  }

  async insert(discordId, steamId) {
    await this.dbPromise;
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    const expireDate = date;

    const sql = `
      INSERT INTO ${TABLE_NAME} (id, steamId, expireDate)
      VALUES (${discordId}, ${steamId}, '${expireDate}')
    `;
    console.log(sql);
    this.db.run(sql);
  }

  async close() {
    await this.dbPromise; // Wait for DB to initialize before commands
    this.db.close((err) => {
      if (err)
        console.error(
          `Error closing the connection to ${DB_NAME}:`,
          err.message
        );
      else console.log(`${DB_NAME} database connection closed.`);
    });
    UserData.instance = null;
  }
}
