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

import "dotenv/config";
import express from "express";
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

// Store for in-progress searches. In production, you'd want to use a DB
const activeInteractions = {};
const maxLobbySize = 3;

function ephemeralBasic(text) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      // Fetches a random emoji to send from a helper function
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
      const { name } = data;

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

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
