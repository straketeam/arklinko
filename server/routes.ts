import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertGameSchema,
  insertTransactionSchema,
  insertSeedSchema,
} from "@shared/schema";

// Provably Fair Game Logic
function generateGameResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): number {
  const hash = crypto
    .createHmac("sha512", serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest("hex");

  // Convert first 8 characters to number between 0-99999
  const result = parseInt(hash.substring(0, 8), 16) % 100000;
  return result / 1000; // Return as decimal (0-99.999)
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current user (demo user for now)
  app.get("/api/user", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("demo_player");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User registration with automatic ARK wallet generation
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Generate ARK wallet
      const words = [
        "abandon",
        "ability",
        "able",
        "about",
        "above",
        "absent",
        "absorb",
        "abstract",
        "absurd",
        "abuse",
        "access",
        "accident",
        "account",
        "accuse",
        "achieve",
        "acid",
      ];
      const passphrase = Array.from(
        { length: 12 },
        () => words[Math.floor(Math.random() * words.length)],
      ).join(" ");
      const arkAddress =
        "A" + crypto.randomBytes(16).toString("hex").substring(0, 33);

      const validated = insertUserSchema.parse({
        username,
        password,
        arkAddress,
        arkPassphrase: passphrase,
        balance: "10.00000000", // 10 ARK starting balance
        totalWagered: "0",
        totalWon: "0",
      });

      const user = await storage.createUser(validated);
      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          arkAddress: user.arkAddress,
          balance: user.balance,
        },
        wallet: {
          address: arkAddress,
          passphrase: passphrase,
        },
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  // Get next game crash point (for real-time display)
  app.post("/api/game/crash-point", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("demo_player");
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get or create active seed
      let seed = await storage.getActiveSeed(user.id);
      if (!seed) {
        const serverSeed = crypto.randomBytes(32).toString("hex");
        seed = await storage.createSeed({
          userId: user.id,
          serverSeed,
          serverSeedHash: crypto
            .createHash("sha256")
            .update(serverSeed)
            .digest("hex"),
          clientSeed: crypto.randomBytes(16).toString("hex"),
          nonce: 0,
          isActive: true,
        });
      }

      // Generate crash point using provably fair algorithm
      const crashPoint = Math.max(
        1.0,
        generateGameResult(seed.serverSeed, seed.clientSeed, seed.nonce) / 10,
      );

      res.json({ crashPoint });
    } catch (error) {
      res.status(500).json({ message: "Error getting crash point" });
    }
  });

  // Play crash game
  app.post("/api/play", async (req, res) => {
    try {
      const { betAmount, cashOutAt } = req.body;
      const user = await storage.getUserByUsername("demo_player");

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user has enough balance
      const userBalance = parseFloat(user.balance);
      const bet = parseFloat(betAmount);

      if (bet > userBalance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      if (bet > 5) {
        return res.status(400).json({ message: "Maximum bet is 5 ARK" });
      }

      // Get active seed
      let seed = await storage.getActiveSeed(user.id);
      if (!seed) {
        return res.status(400).json({ message: "No active seed found" });
      }

      // Generate crash point using provably fair algorithm
      const crashPoint = Math.max(
        1.0,
        generateGameResult(seed.serverSeed, seed.clientSeed, seed.nonce) / 10,
      );
      const playerCashOut = parseFloat(cashOutAt) || 0;

      // Determine win/loss
      const didWin = playerCashOut > 0 && playerCashOut <= crashPoint;
      const payout = didWin ? (bet * playerCashOut).toString() : "0";

      // Create game record
      const gameData = await storage.createGame({
        userId: user.id,
        betAmount: betAmount,
        multiplier: crashPoint.toString(),
        result: didWin ? "win" : "lose",
        payout: payout,
        serverSeed: seed.serverSeed,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        hash: seed.serverSeedHash,
        gameData: { crashPoint, playerCashOut, didWin },
      });

      // Update user balance
      const newBalance = didWin
        ? (userBalance - bet + parseFloat(payout)).toFixed(8)
        : (userBalance - bet).toFixed(8);

      await storage.updateUserBalance(user.id, newBalance);

      // Update seed nonce for next game
      await storage.updateSeed(seed.id, { nonce: seed.nonce + 1 });

      res.json({
        game: gameData,
        crashPoint,
        didWin,
        payout,
        newBalance,
        proof: {
          serverSeed: seed.serverSeed,
          clientSeed: seed.clientSeed,
          nonce: seed.nonce,
          hash: seed.serverSeedHash,
        },
      });
    } catch (error) {
      console.error("Game error:", error);
      res.status(500).json({ message: "Game error" });
    }
  });

  // Get game history
  app.get("/api/games", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("demo_player");
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const games = await storage.getGamesByUserId(user.id, 20);
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user stats
  app.get("/api/stats", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("demo_player");
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const games = await storage.getGamesByUserId(user.id);
      const totalGames = games.length;
      const wins = games.filter((g) => g.result === "win").length;
      const winRate =
        totalGames > 0 ? ((wins / totalGames) * 100).toFixed(2) : "0";

      res.json({
        totalGames,
        wins,
        losses: totalGames - wins,
        winRate: `${winRate}%`,
        totalWagered: user.totalWagered,
        totalWon: user.totalWon,
        profit: (
          parseFloat(user.totalWon) - parseFloat(user.totalWagered)
        ).toFixed(8),
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Verify game fairness
  app.post("/api/verify", async (req, res) => {
    try {
      const { gameId } = req.body;
      const game = await storage.getGame(gameId);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Recalculate result using stored seeds
      const calculatedResult = generateGameResult(
        game.serverSeed,
        game.clientSeed,
        game.nonce,
      );
      const calculatedCrash = Math.max(1.0, calculatedResult / 10);

      res.json({
        gameId: game.id,
        serverSeed: game.serverSeed,
        clientSeed: game.clientSeed,
        nonce: game.nonce,
        hash: game.hash,
        storedCrashPoint: parseFloat(game.multiplier),
        calculatedCrashPoint: calculatedCrash,
        isValid:
          Math.abs(parseFloat(game.multiplier) - calculatedCrash) < 0.001,
      });
    } catch (error) {
      res.status(500).json({ message: "Verification error" });
    }
  });

  // Play Plinko game - NEW ENDPOINT
  app.post("/api/game/play", async (req, res) => {
    try {
      const { betAmount, multiplier, playerAddress } = req.body;
      console.log('Plinko game request:', { betAmount, multiplier, playerAddress });

      // For now, return a mock response to test the frontend
      // The actual ARK blockchain integration would happen here
      const bet = parseFloat(betAmount);
      let payout = 0;
      let isWin = false;

      if (multiplier === -1) {
        payout = 0;
        isWin = false;
      } else if (multiplier === -0.5) {
        payout = bet * 0.5;
        isWin = false;
      } else if (multiplier === 0) {
        payout = bet;
        isWin = false;
      } else if (multiplier > 0) {
        payout = bet * multiplier;
        isWin = multiplier >= 1.25;
      }

      res.json({
        betAmount: bet,
        multiplier,
        payout: payout.toFixed(4),
        isWin,
        transactionId: 'mock_' + Date.now(),
        playerAddress
      });
    } catch (error) {
      console.error("Game play error:", error);
      res.status(500).json({ message: "Game error" });
    }
  });

  // Play Plinko game (legacy endpoint)
  app.post("/api/play-plinko", async (req, res) => {
    // ... rest of existing play-plinko code ...
  });

  // ... rest of existing routes ...

  const httpServer = createServer(app);
  return httpServer;
}
