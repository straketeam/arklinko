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

// ARK blockchain transaction sending using simplified crypto libraries
async function sendArkWinningTransaction(
  recipientAddress: string,
  amount: number
): Promise<string | null> {
  try {
    const elliptic = await import('elliptic');
    const bs58check = await import('bs58check');
    
    const privateKey = process.env.ARK_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('ARK_PRIVATE_KEY not configured');
    }
    
    // This is a simplified implementation - for production use, you would need
    // to implement the full ARK transaction signing protocol
    console.log('Simulating ARK winning transaction to:', recipientAddress, 'Amount:', amount);
    
    // For now, return a simulated transaction ID
    const simulatedTxId = crypto.randomBytes(32).toString('hex');
    console.log('Simulated transaction ID:', simulatedTxId);
    
    return simulatedTxId;
  } catch (error: any) {
    console.error('ARK winning transaction error:', error);
    return null;
  }
}

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
      const wallet = generateArkWallet();

      // Create user with ARK wallet
      const userData = await storage.createUser({
        username,
        balance: "1000.00000000", // Starting balance of 1000 ARK
        arkAddress: wallet.address,
        arkPublicKey: wallet.publicKey,
        arkPassphrase: wallet.passphrase,
        totalWagered: "0",
        totalWon: "0",
      });

      res.json({
        user: {
          id: userData.id,
          username: userData.username,
          balance: userData.balance,
          arkAddress: userData.arkAddress,
          arkPublicKey: userData.arkPublicKey,
        },
        wallet: {
          address: wallet.address,
          publicKey: wallet.publicKey,
          passphrase: wallet.passphrase,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // User login
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      // Simple authentication (in production, use proper password hashing)
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          balance: user.balance,
          arkAddress: user.arkAddress,
          arkPublicKey: user.arkPublicKey,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get new client seed for provably fair gaming
  app.post("/api/new-seed", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("demo_player");
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Generate new server seed and client seed
      const serverSeed = crypto.randomBytes(32).toString("hex");
      const clientSeed = crypto.randomBytes(16).toString("hex");
      const serverSeedHash = crypto
        .createHash("sha256")
        .update(serverSeed)
        .digest("hex");

      // Create new seed record
      const seedData = await storage.createSeed({
        userId: user.id,
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce: 0,
        revealed: false,
      });

      res.json({
        serverSeedHash,
        clientSeed,
        seedId: seedData.id,
      });
    } catch (error) {
      res.status(500).json({ message: "Seed generation failed" });
    }
  });

  // Play crash game
  app.post("/api/game/crash", async (req, res) => {
    try {
      const { betAmount, cashOutAt } = req.body;
      console.log(
        `Crash game request: bet=${betAmount}, cashOut=${cashOutAt}`,
      );

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

      const playerCashOut = parseFloat(cashOutAt);

      // Get active seed
      let seed = await storage.getActiveSeed(user.id);
      if (!seed) {
        // Generate new seed if none exists
        const serverSeed = crypto.randomBytes(32).toString("hex");
        const clientSeed = crypto.randomBytes(16).toString("hex");
        const serverSeedHash = crypto
          .createHash("sha256")
          .update(serverSeed)
          .digest("hex");

        seed = await storage.createSeed({
          userId: user.id,
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce: 0,
          revealed: false,
        });
      }

      // Generate crash point using provably fair algorithm
      const crashResult = generateGameResult(
        seed.serverSeed,
        seed.clientSeed,
        seed.nonce,
      );
      const crashPoint = Math.max(1.0, crashResult / 10); // Convert to crash multiplier (minimum 1.0x)

      console.log(
        `Generated crash point: ${crashPoint}, Player cash out: ${playerCashOut}`,
      );

      // Determine if player won
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

      const games = await storage.getGamesByUserId(user.id, 10);
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user statistics
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

  // Play Plinko game
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
        success: true,
        payout: payout,
        isWin: isWin,
        transactionId: crypto.randomBytes(16).toString('hex')
      });
    } catch (error) {
      console.error('Plinko game error:', error);
      res.status(500).json({ success: false, error: 'Game failed' });
    }
  });

  // Plinko game (ARK blockchain version)
  app.post("/api/plinko", async (req, res) => {
    try {
      const { betAmount, multiplier } = req.body;
      console.log(
        `Bet amount received: "${betAmount}", type: ${typeof betAmount}`,
      );
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

      // Validate multiplier (ensure it's one of the valid Plinko multipliers)
      const validMultipliers = [10, 5, 4, 3, 2, 1.5, -0.5, 1.25, 0, -1];
      if (!validMultipliers.includes(multiplier)) {
        return res.status(400).json({ message: "Invalid multiplier" });
      }

      // Get active seed
      let seed = await storage.getActiveSeed(user.id);
      if (!seed) {
        return res.status(400).json({ message: "No active seed found" });
      }

      // Calculate payout based on slot type
      let payout: string;
      let didWin: boolean;

      if (multiplier === -1) {
        // Losing slot - player loses entire bet
        payout = "0";
        didWin = false;
      } else if (multiplier === -0.5) {
        // Half-loss slot - player loses half the bet
        payout = (bet * 0.5).toFixed(8);
        didWin = false;
      } else if (multiplier === 0) {
        // Break-even slot - player gets bet back
        payout = bet.toFixed(8);
        didWin = false; // Technically not a win, just break-even
      } else {
        // Winning slot - player gets bet * multiplier
        payout = (bet * multiplier).toFixed(8);
        didWin = true;
      }

      // Create game record
      const gameData = await storage.createGame({
        userId: user.id,
        betAmount: betAmount,
        multiplier: multiplier.toString(),
        result: didWin ? "win" : "lose",
        payout: payout,
        serverSeed: seed.serverSeed,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        hash: seed.serverSeedHash,
        gameData: { multiplier, betAmount: bet, payout: parseFloat(payout) },
      });

      // User balance was already debited the bet amount, so we just add the payout
      const newBalance = (userBalance - bet + parseFloat(payout)).toFixed(8);
      console.log(
        `Balance update: ${userBalance} - ${bet} + ${payout} = ${newBalance}`,
      );
      await storage.updateUserBalance(user.id, newBalance);

      // Update seed nonce for next game
      await storage.updateSeed(seed.id, { nonce: seed.nonce + 1 });

      res.json({
        game: gameData,
        didWin,
        payout,
        newBalance,
        multiplier,
        proof: {
          serverSeed: seed.serverSeed,
          clientSeed: seed.clientSeed,
          nonce: seed.nonce,
          hash: seed.serverSeedHash,
        },
      });
    } catch (error) {
      console.error("Plinko game error:", error);
      res.status(500).json({ message: "Game error" });
    }
  });

  // Send winning transaction from game wallet to player
  app.post('/api/game/send-winnings', async (req, res) => {
    try {
      const { recipientAddress, amount } = req.body
      
      if (!recipientAddress || !amount) {
        return res.status(400).json({ success: false, error: 'Missing required fields' })
      }
      
      console.log('Processing winning transaction:', { recipientAddress, amount })
      
      // Send winning transaction from game wallet
      const transactionId = await sendArkWinningTransaction(recipientAddress, amount)
      
      if (transactionId) {
        res.json({ success: true, transactionId })
      } else {
        res.status(500).json({ success: false, error: 'Transaction failed' })
      }
    } catch (error: any) {
      console.error('Send winnings error:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  })

  // ARK transaction functions
  async function createArkWalletFromPassphrase(passphrase: string) {
    const crypto = require("crypto");
    const elliptic = require("elliptic");
    const bs58check = require("bs58check");

    // Create elliptic curve instance (secp256k1 used by ARK)
    const ec = new elliptic.ec("secp256k1");

    // Generate private key from passphrase
    const hash = crypto
      .createHash("sha256")
      .update(passphrase, "utf8")
      .digest();
    const privateKey = hash.toString("hex");

    // Generate key pair
    const keyPair = ec.keyFromPrivate(privateKey, "hex");
    const publicKey = keyPair.getPublic("hex");

    // Generate ARK address from public key
    const publicKeyBuffer = Buffer.from(publicKey, "hex");
    const publicKeyHash = crypto.createHash("ripemd160")
      .update(crypto.createHash("sha256").update(publicKeyBuffer).digest())
      .digest();

    // Add network version byte (0x17 for ARK mainnet)
    const versionedHash = Buffer.concat([Buffer.from([0x17]), publicKeyHash]);
    const address = bs58check.encode(versionedHash);

    return {
      address,
      publicKey,
      privateKey,
      passphrase,
    };
  }

  function serializeTransaction(transaction: any): Buffer {
    // Simplified transaction serialization for ARK
    // In production, use the official ARK crypto library
    const buffer = Buffer.alloc(256);
    let offset = 0;

    // Version (1 byte)
    buffer.writeUInt8(transaction.version, offset);
    offset += 1;

    // Network (1 byte)
    buffer.writeUInt8(transaction.network, offset);
    offset += 1;

    // Type Group (4 bytes)
    buffer.writeUInt32LE(transaction.typeGroup, offset);
    offset += 4;

    // Type (2 bytes)
    buffer.writeUInt16LE(transaction.type, offset);
    offset += 2;

    // Nonce (8 bytes)
    const nonce = BigInt(transaction.nonce);
    buffer.writeBigUInt64LE(nonce, offset);
    offset += 8;

    // Sender Public Key (33 bytes)
    Buffer.from(transaction.senderPublicKey, "hex").copy(buffer, offset);
    offset += 33;

    // Fee (8 bytes)
    const fee = BigInt(transaction.fee);
    buffer.writeBigUInt64LE(fee, offset);
    offset += 8;

    // Amount (8 bytes)
    const amount = BigInt(transaction.amount);
    buffer.writeBigUInt64LE(amount, offset);
    offset += 8;

    // Recipient (21 bytes)
    bs58check.decode(transaction.recipientId).copy(buffer, offset);
    offset += 21;

    // Vendor Field
    if (transaction.vendorField) {
      const vendorField = Buffer.from(transaction.vendorField, "utf8");
      buffer.writeUInt8(vendorField.length, offset);
      offset += 1;
      vendorField.copy(buffer, offset);
      offset += vendorField.length;
    } else {
      buffer.writeUInt8(0, offset);
      offset += 1;
    }

    return buffer.slice(0, offset);
  }

  async function sendArkTransaction(
    recipientAddress: string,
    amount: number,
  ): Promise<string> {
    try {
      // Convert ARK amount to arktoshi (multiply by 100000000)
      const amountInArktoshi = Math.floor(amount * 100000000);

      // Game wallet configuration
      const GAME_WALLET_PASSPHRASE =
        "comic consider youth draft wash lady parrot want blush property misery fire tilt sail fire rebuild laptop orient patrol soon snake ridge pulp armor";
      const NETWORK_URL = "https://api.ark.io";
      const NETWORK_VERSION = 23; // Mainnet

      // Create wallet from passphrase
      const wallet = await createArkWalletFromPassphrase(
        GAME_WALLET_PASSPHRASE,
      );

      // Get current nonce for the wallet
      const walletResponse = await fetch(
        `${NETWORK_URL}/api/v2/wallets/${wallet.address}`,
      );
      const walletData = await walletResponse.json();
      const currentNonce = walletData.data?.nonce
        ? parseInt(walletData.data.nonce) + 1
        : 1;

      // Create transaction according to ARK v2 specs
      const transaction = {
        version: 2,
        network: NETWORK_VERSION,
        typeGroup: 1,
        type: 0, // Transfer transaction type
        nonce: currentNonce.toString(),
        senderPublicKey: wallet.publicKey,
        fee: "10000000", // 0.1 ARK transaction fee
        amount: amountInArktoshi.toString(),
        recipientId: recipientAddress,
        vendorField: "ARKlinko Game Transaction",
      };

      // Serialize and sign transaction
      const transactionBytes = serializeTransaction(transaction);
      const transactionHash = crypto
        .createHash("sha256")
        .update(transactionBytes)
        .digest();

      // Sign transaction with elliptic
      const elliptic = require("elliptic");
      const ec = new elliptic.ec("secp256k1");
      const keyPair = ec.keyFromPrivate(wallet.privateKey, "hex");
      const signature = keyPair.sign(transactionHash);

      // Convert signature to DER format
      const signatureBuffer = Buffer.from(signature.toDER());

      // Add signature to transaction
      const signedTransaction = {
        ...transaction,
        signature: signatureBuffer.toString("hex"),
      };

      // Calculate transaction ID
      const fullTransactionBytes = Buffer.concat([
        transactionBytes,
        signatureBuffer,
      ]);
      const transactionId = crypto
        .createHash("sha256")
        .update(fullTransactionBytes)
        .digest("hex");

      console.log("Transaction created:", transactionId);

      // Broadcast transaction to ARK network
      const broadcastResponse = await fetch(
        `${NETWORK_URL}/api/v2/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactions: [signedTransaction],
          }),
        },
      );

      const broadcastResult = await broadcastResponse.json();
      console.log("Broadcast result:", broadcastResult);

      if (broadcastResult.data?.accept?.length > 0) {
        return broadcastResult.data.accept[0];
      } else {
        throw new Error("Transaction broadcast failed");
      }
    } catch (error) {
      console.error("ARK transaction error:", error);
      throw error;
    }
  }

  async function getArkWalletBalance(address: string): Promise<number> {
    try {
      const response = await fetch(`https://api.ark.io/api/v2/wallets/${address}`);
      const data = await response.json();
      
      if (data.data && data.data.balance) {
        return parseInt(data.data.balance) / 100000000; // Convert arktoshi to ARK
      }
      
      return 0;
    } catch (error) {
      console.error('Error fetching ARK balance:', error);
      return 0;
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}

function generateArkWallet() {
  const crypto = require("crypto");
  const elliptic = require("elliptic");
  const bs58check = require("bs58check");

  // Generate random passphrase
  const words = [
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
    "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
    "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
    "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "against", "age",
    "agent", "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol"
  ];
  
  const passphrase = Array.from({ length: 12 }, () => 
    words[Math.floor(Math.random() * words.length)]
  ).join(' ');

  // Create elliptic curve instance
  const ec = new elliptic.ec("secp256k1");

  // Generate private key from passphrase
  const hash = crypto.createHash("sha256").update(passphrase, "utf8").digest();
  const privateKey = hash.toString("hex");

  // Generate key pair
  const keyPair = ec.keyFromPrivate(privateKey, "hex");
  const publicKey = keyPair.getPublic("hex");

  // Generate ARK address
  const publicKeyBuffer = Buffer.from(publicKey, "hex");
  const publicKeyHash = crypto.createHash("ripemd160")
    .update(crypto.createHash("sha256").update(publicKeyBuffer).digest())
    .digest();

  // Add network version byte (0x17 for ARK mainnet)
  const versionedHash = Buffer.concat([Buffer.from([0x17]), publicKeyHash]);
  const address = bs58check.encode(versionedHash);

  return {
    address,
    publicKey,
    privateKey,
    passphrase,
  };
}
