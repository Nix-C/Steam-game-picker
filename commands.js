import "dotenv/config";
import { InstallGlobalCommands } from "./utils.js";

// // Simple test command
// const TEST_COMMAND = {
//   name: "test",
//   description: "Basic command",
//   type: 1,
//   integration_types: [0, 1],
//   contexts: [0, 1, 2],
// };

const GAME_PICKER_COMMAND = {
  name: "game-picker",
  description: "Find a game to play on Steam",
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

const ALL_COMMANDS = [GAME_PICKER_COMMAND];

InstallGlobalCommands(process.env.CLIENT_ID, ALL_COMMANDS);
