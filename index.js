const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
// const PORT = process.env.PORT || 3000;
const PORT = process.env.PORT;

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
    return res.status(400).json({ error: "Invalid userId. Must be a positive integer." });
  }

  // Fetch all public games for this user
  let gamesResponse;
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
    return res.status(502).json({ error: "Could not reach the Roblox games API." });
  }

  // The v2 API returns placeVisits directly on each game object
  const rawGames = gamesResponse.data?.data ?? [];

  if (rawGames.length === 0) {
    return res.json({ userId, totalVisits: 0, games: [] });
  }

  const games = rawGames.map((game) => ({
    name: game.name ?? "Unknown",
    placeVisits: game.placeVisits ?? 0,
  }));

  const totalVisits = games.reduce((sum, game) => sum + (game.placeVisits || 0), 0);

  return res.json({ userId, totalVisits, games });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
