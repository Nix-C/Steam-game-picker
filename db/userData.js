import sqlite3 from "sqlite3";

const DB_NAME = "user_data";
const TABLE_NAME = "users";

export class UserData {
  constructor() {
    // Singleton check
    if (UserData.instance) {
      console.warn("An instance of UserData already exists!");
      return UserData.instance;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      this.db = new sqlite3.Database("./db/" + DB_NAME + ".db", (err) => {
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

  /**
   * Insert user into table.
   * @param {string} discordId
   * @param {string} steamId
   */
  async insertUser(discordId, steamId) {
    await this.dbPromise;
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    const expireDate = date;

    const sql = `
      INSERT INTO ${TABLE_NAME} (id, steamId, expireDate)
      VALUES (${discordId}, ${steamId}, '${expireDate.toISOString()}')
    `;
    this.db.run(sql, function (err) {
      if (err) {
        console.error(`Could not insert into ${DB_NAME}`, err);
      } else {
        console.log("Success!");
      }
    });
  }

  async getUser(discordId) {
    await this.dbPromise;
    const sql = `SELECT id, steamId FROM ${TABLE_NAME} WHERE id = ?`;
    return new Promise((resolve, reject) => {
      this.db.get(sql, [discordId], (err, row) => {
        if (err) {
          console.error(`Could not retrive row with id ${discordId};`, err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getSteamIds(discordIds) {
    const placeholders = discordIds.map(() => "?").join(",");
    const sql = `SELECT steamId FROM ${TABLE_NAME} WHERE id IN (${placeholders})`;
    return new Promise((resolve, reject) => {
      this.db.all(sql, discordIds, (err, rows) => {
        if (err) {
          console.error(
            `Could not retrieve steamIds with ids: ${discordIds};`,
            err
          );
          reject(err);
        } else {
          const steamIds = rows.map((row) => row.steamId);
          console.log(steamIds);
          resolve(steamIds);
        }
      });
    });
  }

  /**
   * Close DB Connection
   */
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

  async initialize() {
    await this.dbPromise; // Wait for DB to initialize before commands
    const sql = `CREATE TABLE ${TABLE_NAME} (
      id INTEGER PRIMARY KEY,
      steamId TEXT NOT NULL,
      expireDate TEXT NOT NULL
    )`;
    this.db.run(sql, function (err) {
      if (err) {
        console.error(`Could not initialize ${DB_NAME}`, err);
      } else {
        console.log(`Initialized ${DB_NAME}`);
      }
    });
  }

  async cleanup() {
    const sql = `DELETE FROM ${TABLE_NAME} WHERE expireDate < datetime('now')`;
    this.db.run(sql, function (err) {
      if (err) {
        console.error(`Could not run cleanup on ${TABLE_NAME}`, err);
      } else {
        console.log(`Cleaned up ${TABLE_NAME}`);
      }
    });
  }
}
