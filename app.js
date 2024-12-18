/**
 * # Glossary
 * ## Nouns
 * Steam search party; Party - The set of users looking for a common game.
 * Leader - The user who started the party.
 * Member - User(s) belonging to a Leader's party.
 * ## Party States
 * Open - Members can join or leave party.
 * Closed - Leader has begun the search; members cannot join or leave.
 * Disbanned - Leader canceled the party (before or after closing); members cannot join or leave.
 * ## Party Actions
 * Join - User will be added to the party.
 * Leave - User will be removed from the party.
 * Begin Search - Leader closes party and searches for a game.
 * Disband - Leader cancles party.
 */

/**
 * Notes
 * - Interaction Tokens are valid for 15 minutes. Delete after 15 minutes.
 */

/**
 * Navigating the user back to discord using the `discord://` protocol
 *
 * Unofficial documentation:
 * https://gist.github.com/ghostrider-05/8f1a0bfc27c7c4509b4ea4e8ce718af0
 */

import "dotenv/config";
import express from "express";
import url from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import axios from "axios";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKeyMiddleware,
} from "discord-interactions";
import { getRandomEmoji, DiscordRequest } from "./utils.js";

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Include my public pages
app.use(express.static(path.join(__dirname, "public")));

// Store for in-progress searches. In production, you'd want to use a DB
const activeInteractions = {};
const maxLobbySize = 3;

/**
 * Steam ID 'DB'
 *
 * {
 *    userId: discord_id,
 *    steamId: steam_id
 * }
 */
const userData = {};

function ephemeralBasic(text) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: text,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  };
}

// TODO: Change to res.send with type of UPDATE_MESSAGE
async function updateOriginalInteraction(req, partyData) {
  const endpoint = `webhooks/${process.env.APP_ID}/${partyData.originalMessageToken}/messages/@original`;
  try {
    await DiscordRequest(endpoint, {
      method: "PATCH",
      body: {
        content: `<@${
          partyData.userIds[0]
        }> started a game search party! ${getRandomEmoji()}\n\`Members: ${
          partyData.userIds.length
        }/3\` ${partyData.userIds.forEach((userId) => `<@${userId}>`)}`,
      },
    });
  } catch (err) {
    console.error("Error updating message:", err);
  }
}

const RequestSteamId = {
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: {
    content:
      "This bot wants to access your Steam connection. \nNOTE: Make sure you've connected your Steam account to Discord first!",
    flags: InteractionResponseFlags.EPHEMERAL,
    components: [
      {
        type: MessageComponentTypes.ACTION_ROW,
        components: [
          {
            type: MessageComponentTypes.BUTTON,
            label: "Allow Access",
            style: ButtonStyleTypes.LINK,
            url: "https://discord.com/oauth2/authorize?client_id=1268350054863998998&response_type=code&redirect_uri=https%3A%2F%2Floving-casual-minnow.ngrok-free.app%2Fapi%2Fauth%2Fdiscord%2Fredirect&scope=identify+connections",
          },
        ],
      },
    ],
  },
};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post(
  "/interactions",
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  async function (req, res) {
    // Interaction type and data
    const { type, id, data, context } = req.body;
    const user = context === 0 ? req.body.member.user : req.body.user;
    /**
     * Handle verification requests
     */
    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    /**
     * Handle slash command requests
     * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
     */

    if (type === InteractionType.APPLICATION_COMMAND) {
      // Require user permission
      if (!userData[user.id]) {
        await res.send(RequestSteamId);
        return;
      }

      const { name } = data;
      if (name === "test") {
        await res.send(RequestSteamId);
      }
      if (name === "game-picker" && id) {
        // Init session in "db"
        activeInteractions[id] = {
          userIds: [user.id],
          startTime: Date.now(),
          originalMessageToken: undefined,
        };
        // Send a message into the channel
        const response = await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `<@${
              user.id
            }> started a game search party! ${getRandomEmoji()}\n\`Members: 1/3\``,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.BUTTON,
                    label: "Join",
                    style: ButtonStyleTypes.SUCCESS,
                    custom_id: `join_btn_${req.body.id}`,
                  },
                  {
                    type: MessageComponentTypes.BUTTON,
                    label: "Leave",
                    style: ButtonStyleTypes.SECONDARY,
                    custom_id: `leave_btn_${req.body.id}`,
                  },
                ],
              },
            ],
          },
        });

        // Store token of original response
        activeInteractions[id].originalMessageToken = response.req.body.token;

        await DiscordRequest(
          `webhooks/${process.env.APP_ID}/${req.body.token}`,
          {
            method: "POST",
            body: {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              flags: InteractionResponseFlags.EPHEMERAL,
              content: "Leader Controls:",
              components: [
                {
                  type: MessageComponentTypes.ACTION_ROW,
                  components: [
                    {
                      type: MessageComponentTypes.BUTTON,
                      label: "Begin Search",
                      style: ButtonStyleTypes.SUCCESS,
                      custom_id: `begin_btn_${req.body.id}`,
                    },
                    {
                      type: MessageComponentTypes.BUTTON,
                      label: "Disband",
                      style: ButtonStyleTypes.DANGER,
                      custom_id: `disband_btn_${req.body.id}`,
                    },
                  ],
                },
              ],
            },
          }
        );
      }
      return;
    }

    if (type === InteractionType.MESSAGE_COMPONENT) {
      const { custom_id } = req.body.data;
      const [name, _, interactionId] = custom_id.split("_");
      const partyData = activeInteractions?.[interactionId];

      if (!userData[user.id]) {
        await res.send(RequestSteamId);
        return;
      }

      if (partyData) {
        // Handle join/leave
        if (name === "join" || name === "leave") {
          const userExists = partyData.userIds.includes(user.id);
          if (name === "leave" && userExists) {
            // remove member
            partyData.userIds = partyData.userIds.filter(
              (userId) => userId !== user.id
            );
            await updateOriginalInteraction(req, partyData);
            return res.send(
              ephemeralBasic(
                `You've left <@${activeInteractions[interactionId].userIds[0]}>'s party!`
              )
            );
          } else if (name === "leave" && !userExists) {
            return res.send(
              ephemeralBasic(
                `You aren't in <@${activeInteractions[interactionId].userIds[0]}>'s party.`
              )
            );
          }
          // NOTE: STATEMENT STILL FALL THROUGH, CONSIDER RETURNING INSIDE
          const roomAvailable = partyData.userIds.length < maxLobbySize;
          if (name === "join" && !userExists) {
            if (roomAvailable) {
              partyData.userIds.push(user.id);
              await updateOriginalInteraction(req, partyData);
              return res.send(
                ephemeralBasic(
                  `You've joined <@${activeInteractions[interactionId].userIds[0]}>'s party!`
                )
              );
            } else {
              return res.send(
                ephemeralBasic(
                  `<@${activeInteractions[interactionId].userIds[0]}>'s party is already full!`
                )
              );
            }
          } else if (name === "join" && userExists) {
            return res.send(
              ephemeralBasic(
                `You've already joined <@${activeInteractions[interactionId].userIds[0]}>'s party!`
              )
            );
          }

          return res.send(ephemeralBasic(`Hmm, something went wrong.`));
        }

        if (name === "begin" || name === "disband") {
          if (name === "disband" && partyData) {
            try {
              // Delete control message
              const deleteEndpoint = `webhooks/${process.env.APP_ID}/${partyData.originalMessageToken}/messages/${req.body.message.id}`;
              await DiscordRequest(deleteEndpoint, {
                method: "DELETE",
                body: {},
              });

              // Update interaction message
              const pathEndpoint = `webhooks/${process.env.APP_ID}/${partyData.originalMessageToken}/messages/@original`;
              await DiscordRequest(pathEndpoint, {
                method: "PATCH",
                body: {
                  content: `<@${partyData.userIds[0]}> disbanned the party.`,
                  components: [],
                },
              });

              // remove party from db
              delete activeInteractions?.[interactionId];

              // Send user confirmation
              return res.send(ephemeralBasic(`You canceled the party.`));
            } catch (err) {
              console.error("Error disbanding:", err);
              return;
            }
          } else if (name === "disband" && !partyData) {
            return res.send(ephemeralBasic(`This party does not exist! 👻`));
          }

          if (name === "begin" && partyData) {
            // Respond to message with body and loading state
            const deleteEndpoint = `webhooks/${process.env.APP_ID}/${partyData.originalMessageToken}/messages/${req.body.message.id}`;
            // Delete controls
            await DiscordRequest(deleteEndpoint, { method: "Delete" });

            // await res.send({
            //   type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            //   data: {
            //     content: `Searching . . .`,
            //     components: [],
            //   },
            // });

            // Send loading message
            const patchEndpoint = `webhooks/${process.env.APP_ID}/${partyData.originalMessageToken}/messages/@original`;
            await DiscordRequest(patchEndpoint, {
              method: "PATCH",
              body: {
                content: `<@${partyData.userIds[0]}> is looking for a game...`,
                body: {
                  components: [{}],
                },
              },
            });

            // Get game Data
            const { gameName, storeURL, imgURL } = {
              gameName: "Old School Runescape",
              storeURL: "https://store.steampowered.com/app/1343370",
              imgURL:
                "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1343370/6f3b359a68383291bcd2ab49aac079c13c02d8bb.jpg",
            };

            // Update message with game data
            await DiscordRequest(patchEndpoint, {
              method: "PATCH",
              body: {
                content: `<@${partyData.userIds[0]}> found ${gameName}`,
                body: {
                  components: [
                    {
                      type: MessageComponentTypes.BUTTON,
                      style: ButtonStyleTypes.LINK,
                      label: "View on Steam",
                      url: storeURL,
                    },
                  ],
                },
              },
            });

            // remove party from db
            delete activeInteractions?.[interactionId];

            return;
          } else if (name === "begin" && !partyData) {
            return res.send(ephemeralBasic(`This party does not exist! 👻`));
          }
        }
      } else {
        return res.send(ephemeralBasic(`This party does not exist! 👻`));
      }
    }

    /**
     * Handle requests from interactive components
     * See https://discord.com/developers/docs/interactions/message-components#responding-to-a-component-interaction
     */

    console.error("unknown interaction type", type);
    return res.status(400).json({ error: "unknown interaction type" });
  }
);

// OAuth2 redirect
app.get("/api/auth/discord/redirect", async (req, res) => {
  const { code } = req.query;
  if (code) {
    const formdata = new url.URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "authorization_code",
      code: code.toString(),
      redirect_uri: `https://loving-casual-minnow.ngrok-free.app/api/auth/discord/redirect`,
    });

    // Get access token
    const output = await axios
      .post("https://discord.com/api/oauth2/token", formdata, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .catch(function (error) {
        console.error(error, "An error occurred sending data");
      });

    // If access_token retrieved
    if (output.data?.access_token) {
      const access = output.data.access_token;

      // Request user discord identity
      const identity_res = await axios
        .get(`https://discord.com/api/users/@me`, {
          headers: {
            Authorization: `Bearer ${access}`,
          },
        })
        .catch(function (error) {
          console.error(error);
        });

      const discordId = identity_res.data.id;
      console.log("Discord ID", discordId);

      // Request user connections
      const connections_res = await axios
        .get(`https://discord.com/api/users/@me/connections`, {
          headers: {
            Authorization: `Bearer ${access}`,
          },
        })
        .catch(function (error) {
          console.error(error);
        });
      const steamConnection = connections_res.data?.find(
        (connection) => connection.type === "steam"
      );

      console.log("Steam ID:", steamConnection.id);
      if (steamConnection.id && discordId) {
        userData[discordId] = steamConnection.id;
        console.log(userData);
        res.status(200).redirect("/success.html");
      }

      return;
    }
  }

  return;
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
