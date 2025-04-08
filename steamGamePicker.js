import "dotenv/config";

// fetch request
async function getSteamLibrary(steamId, key = process.env.STEAM_API_KEY) {
  const requestOptions = {
    method: "GET",
    redirect: "follow",
  };

  console.log("Fetching Steam library", steamId);
  const request = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&include_appinfo=true&include_played_free_games=true&steamid=${steamId}=&format=json`;
  const response = await fetch(request, requestOptions).catch((error) =>
    console.error(error)
  );

  try {
    const status = [response.status, response.statusText];
    switch (status[0]) {
      case 200:
        break; // All clear!
      default:
        console.error("Error from Steam API:".status[0], status[1]); // Show the error.
    }
  } catch {
    console.error(
      "No status code detected. Something may have went wrong.",
      request
    );
    return null;
  }

  // Format to return library data only
  const responseJson = await response.json();

  return responseJson.response;
}

// Get game data from pcgamingwiki.com's MediaWikiAPI
// https://www.pcgamingwiki.com/wiki/PCGamingWiki:API
async function isGameMultiplayer(appId) {
  if (appId) {
    const request = `https://www.pcgamingwiki.com/w/api.php?action=cargoquery&tables=Infobox_game=IG,Multiplayer=M&join_on=IG._pageName=M._pageName&fields=IG._pageName=Page,IG.Steam_AppID,M.Online_players=multiplayer&where=IG.Steam_AppID%20HOLDS%20%22${appId}%22&format=json`;
    const response = await fetch(request).catch((error) => {
      console.error(error);
    });

    const data = await response.json();
    const multiplayer = data?.cargoquery[0].title?.multiplayer;

    // Add error handling/reporting

    if (multiplayer) {
      return true;
    } else {
      return false;
    }
  } else {
    console.error("ERROR: Bad appId provided.");
    return false;
  }
}

// 🚨CANT HANDLE TOO MANY REQUESTS🚨
// Get game data from Steam API
async function isGameMultiplayer_OLD(appId) {
  const requestOptions = {
    method: "GET",
    redirect: "follow",
  };

  //console.log("Checking if multiplayer...", appId)
  const request = `http://store.steampowered.com/api/appdetails?appids=${appId}`;
  const response = await fetch(request, requestOptions).catch((error) =>
    console.error(error)
  );

  try {
    const status = [response.status, response.statusText];
    switch (status[0]) {
      case 200:
        break; // All clear!
      default:
        console.error("Error from Steam API:".status[0], status[1]); // Show the error.
    }
  } catch {
    console.error(
      "No status code detected. Something may have went wrong.",
      request,
      response
    );
    return false;
  }

  const response_json = await response.json();

  if (response_json[appId].success == true) {
    const categories = response_json[appId].data.categories;
    try {
      return categories.find((category) => category.id == 1) ? true : false;
    } catch {
      return false;
    }
  } else {
    return false;
  }
}

async function findCommonMultiplayerGame(...libs) {
  // Sort the libraries by size (smallest to largest)
  const sorted = libs.sort((a, b) => a.games.length - b.games.length);
  const baseLib = sorted[0];
  const otherLibs = sorted.slice(1);

  while (baseLib.games.length > 0) {
    const randomIndex = Math.floor(Math.random() * baseLib.games.length);
    const game = baseLib.games[randomIndex];
    const gameId = game.appid;

    const allHaveGame = otherLibs.every((lib) =>
      lib.games.some((g) => g.appid === gameId)
    );

    if (allHaveGame && (await isGameMultiplayer(gameId))) {
      return game;
    }

    // Remove checked game to avoid infinite loop
    baseLib.games.splice(randomIndex, 1);
  }

  return null; // No common multiplayer game found
}

// Return shared game
export async function getSharedGame(userIds) {
  console.log("Comparing steam libraries...");
  let libraries = [];
  for (const userId in userIds) {
    const library = await getSteamLibrary(userIds[userId]);
    if (library.games != undefined) {
      libraries.push(library);
    } else {
      const error = new Error("Could not get games from response.");
      throw error;
    }
  }

  if (libraries.length == 1) {
    const random = Math.floor(Math.random() * libraries[0].games.length);
    return libraries[0].games[random];
  } else if (libraries.length > 1) {
    return await findCommonMultiplayerGame(...libraries);
  } else {
    console.error(
      "Could not compare libraries. Number of libraries:".libraries.length
    );
  }

  return null;
}
