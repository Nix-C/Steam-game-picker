import { UserData } from "./userData.js";

const userData = new UserData();
const sql = `CREATE TABLE userData (
  id TEXT PRIMARY KEY,
  steamId TEXT NOT NULL,
  expireDate TEXT NOT NULL
)`;

userData.db.run(sql, (err) => {
  if (err) console.error("Error initializing UserData.", err);
  else console.log("Successfully initialized UserData.");
});

userData.close();
