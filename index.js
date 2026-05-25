const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT;

const VERSION = "7";

app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("API is running");
});

// GET /api/visits/:userid
app.get("/api/visits/:userid", async (req, res) => {
  const userId = Number(req.params.userid);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      error: "Invalid userId. Must be a positive integer.",
    });
  }

  let gamesResponse;
  let groupsResponse;
  let groupGames = [];

  // ---------------------------
  // 1. Get user groups
  // ---------------------------
  try {
    groupsResponse = await axios.get(
      `https://groups.roblox.com/v2/users/${userId}/groups/roles`
    );
  } catch (err) {
    groupsResponse = null;
  }

  // ---------------------------
  // 2. Get user games
  // ---------------------------
  try {
    gamesResponse = await axios.get(
      `https://games.roblox.com/v2/users/${userId}/games`,
      { params: { accessFilter: "Public", limit: 50 } }
    );
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        error: "Failed to fetch games from Roblox.",
        details: err.response.data,
      });
    }
    return res.status(502).json({
      error: "Could not reach Roblox API.",
    });
  }

  const rawGames = gamesResponse.data?.data ?? [];

  // ---------------------------
  // 3. Get group games (rank > 250)
  // ---------------------------
  const groups = groupsResponse?.data?.data ?? [];

const highRankGroups = groups
  .filter((g) => {
    if (!g.role) return false;

    const rankOk = g.role.rank > 250;

    const nameOk =
      typeof g.role.name === "string" &&
      (g.role.name.toLowerCase().includes("dev") ||
        g.role.name.toLowerCase().includes("contributor"));

    return rankOk && nameOk;
  })
  .map((g) => g.group?.id)
  .filter(Boolean);

  if (highRankGroups.length > 0) {
    
    //const groupRequests = highRankGroups.map((groupId) =>
     // axios
      //  .get(`https://games.roblox.com/v2/groups/${groupId}/games`)
     //   .then((res) => res.data?.data ?? [])
      //  .catch(() => [])
  //  );

   // const groupResults = await Promise.all(groupRequests);
  //  groupGames = groupResults.flat();

const fetchAllGroupGames = async (groupId) => {
  let cursor = null;
  let allGames = [];

  while (true) {
    try {
      const res = await axios.get(
        `https://games.roblox.com/v2/groups/${groupId}/games`,
        {
          params: {
            limit: 50,
            cursor: cursor || undefined,
          },
        }
      );

      const data = res.data;

      if (!data || !Array.isArray(data.data)) break;

      allGames = allGames.concat(data.data);

      if (!data.nextPageCursor) break;

      cursor = data.nextPageCursor;
    } catch (err) {
      console.log("Group fetch failed:", groupId);
      break;
    }
  }

  return allGames;
};

const groupResults = await Promise.all(
  highRankGroups.map((groupId) =>
    fetchAllGroupGames(groupId).catch(() => [])
  )
);

groupGames = groupResults.flat();
  }
  
  // ---------------------------
  // 4. Merge all games
  // ---------------------------
  const allGamesRaw = [...rawGames, ...groupGames];

  if (allGamesRaw.length === 0) {
    return res.json({
      userId,
      totalVisits: 0,
      games: [],
    });
  }

  // ---------------------------
  // 5. Format output
  // ---------------------------
  const games = allGamesRaw.map((game) => ({
    name: game.name ?? "Unknown",
    placeVisits: game.placeVisits ?? 0,
  }));

  // ---------------------------
  // 6. Total visits
  // ---------------------------
  const totalVisits = games.reduce(
    (sum, game) => sum + (game.placeVisits || 0),
    0
  );

  return res.json({
    userId,
    totalVisits,
    games,
    version: VERSION,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
