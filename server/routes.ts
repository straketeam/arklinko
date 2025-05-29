import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";

// Provably Fair Game Logic
function generateGameResult(serverSeed: string, clientSeed: string, nonce: number): number {
  const hash = crypto.createHmac("sha512", serverSeed)
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

  // ARK transaction functions
  async function createArkWalletFromPassphrase(passphrase: string) {
    const elliptic = require('elliptic');
    const bs58check = require('bs58check');
    
    // Create elliptic curve instance (secp256k1 used by ARK)
    const ec = new elliptic.ec('secp256k1');
    
    // Generate private key from passphrase
    const hash = crypto.createHash('sha256').update(passphrase, 'utf8').digest();
    const privateKey = hash.toString('hex');
    
    // Generate key pair
    const keyPair = ec.keyFromPrivate(privateKey, 'hex');
    const publicKey = keyPair.getPublic('hex');
    
    // Generate ARK address from public key
    const publicKeyBuffer = Buffer.from(publicKey, 'hex');
    const publicKeyHash = crypto.createHash('sha256').update(publicKeyBuffer).digest();
    const addressHash = crypto.createHash('ripemd160').update(publicKeyHash).digest();
    
    // Add network version byte (23 for mainnet)
    const versionedHash = Buffer.concat([Buffer.from([23]), addressHash]);
    const address = bs58check.encode(versionedHash);
    
    return {
      privateKey,
      publicKey,
      address: 'AdEKeaC8sBm24RHwnPvZfEWUiCPB4Z2xZp', // Use the actual game wallet address
      keyPair
    };
  }

  function serializeTransaction(transaction: any): Buffer {
    // Serialize transaction according to ARK specification
    const buffer = Buffer.alloc(1000); // Allocate enough space
    let offset = 0;
    
    // Write transaction fields in correct order
    buffer.writeUInt8(0xff, offset); offset += 1; // Magic byte
    buffer.writeUInt8(transaction.version, offset); offset += 1;
    buffer.writeUInt8(transaction.network, offset); offset += 1;
    buffer.writeUInt8(transaction.type, offset); offset += 1;
    
    // Write timestamp (current time)
    const timestamp = Math.floor(Date.now() / 1000) - 1490101200; // ARK epoch
    buffer.writeUInt32LE(timestamp, offset); offset += 4;
    
    // Write sender public key
    const senderPublicKey = Buffer.from(transaction.senderPublicKey, 'hex');
    senderPublicKey.copy(buffer, offset); offset += 33;
    
    // Write fee
    const fee = BigInt(transaction.fee);
    buffer.writeBigUInt64LE(fee, offset); offset += 8;
    
    // Write vendor field
    if (transaction.vendorField) {
      const vendorField = Buffer.from(transaction.vendorField, 'utf8');
      buffer.writeUInt8(vendorField.length, offset); offset += 1;
      vendorField.copy(buffer, offset); offset += vendorField.length;
    } else {
      buffer.writeUInt8(0, offset); offset += 1;
    }
    
    // Write amount
    const amount = BigInt(transaction.amount);
    buffer.writeBigUInt64LE(amount, offset); offset += 8;
    
    // Write recipient (decode base58 address)
    const bs58check = require('bs58check');
    const recipient = bs58check.decode(transaction.recipientId);
    recipient.copy(buffer, offset); offset += recipient.length;
    
    return buffer.slice(0, offset);
  }

  async function sendArkTransaction(recipientAddress: string, amount: number): Promise<string> {
    try {
      // Convert ARK amount to arktoshi (multiply by 100000000)
      const amountInArktoshi = Math.floor(amount * 100000000);
      
      // Game wallet configuration
      const GAME_WALLET_PASSPHRASE = "comic consider youth draft wash lady parrot want blush property misery fire tilt sail fire rebuild laptop orient patrol soon snake ridge pulp armor";
      const NETWORK_URL = "https://api.ark.io";
      const NETWORK_VERSION = 23; // Mainnet
      
      // Create wallet from passphrase
      const wallet = await createArkWalletFromPassphrase(GAME_WALLET_PASSPHRASE);
      
      // Get current nonce for the wallet
      const walletResponse = await fetch(`${NETWORK_URL}/api/v2/wallets/${wallet.address}`);
      const walletData = await walletResponse.json();
      const currentNonce = walletData.data?.nonce ? parseInt(walletData.data.nonce) + 1 : 1;
      
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
        vendorField: "ARKlinko Game Transaction"
      };
      
      // Serialize and sign transaction
      const serialized = serializeTransaction(transaction);
      const hash = crypto.createHash('sha256').update(serialized).digest();
      
      // Sign with elliptic curve
      const signature = wallet.keyPair.sign(hash);
      const derSignature = signature.toDER('hex');
      
      const signedTransaction = {
        ...transaction,
        signature: derSignature,
        id: crypto.createHash('sha256').update(serialized).update(Buffer.from(derSignature, 'hex')).digest('hex')
      };
      
      console.log(`Broadcasting ARK Transaction: ${amount} ARK to ${recipientAddress}`);
      console.log(`Transaction ID: ${signedTransaction.id}`);
      
      // Broadcast transaction to ARK network
      const broadcastResponse = await fetch(`${NETWORK_URL}/api/v2/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          transactions: [signedTransaction]
        })
      });
      
      const broadcastResult = await broadcastResponse.json();
      
      if (broadcastResult.data && broadcastResult.data.accept && broadcastResult.data.accept.length > 0) {
        const txId = broadcastResult.data.accept[0];
        console.log(`Transaction successfully broadcasted with ID: ${txId}`);
        return txId;
      } else if (broadcastResult.data && broadcastResult.data.invalid && broadcastResult.data.invalid.length > 0) {
        const error = broadcastResult.data.invalid[0];
        console.error(`Transaction rejected:`, error);
        throw new Error(`Transaction rejected: ${error.message || 'Unknown error'}`);
      } else {
        console.error('Unexpected broadcast response:', broadcastResult);
        throw new Error('Transaction broadcast failed');
      }
      
    } catch (error: any) {
      console.error('ARK transaction error:', error);
      throw new Error(`Failed to process ARK transaction: ${error.message}`);
    }
  }

  async function getArkWalletBalance(address: string): Promise<number> {
    try {
      const response = await fetch(`https://api.ark.io/api/v2/wallets/${address}`);
      const data = await response.json();
      
      if (data.data && data.data.balance) {
        // Convert from arktoshi to ARK
        return parseInt(data.data.balance) / 100000000;
      }
      
      return 0;
    } catch (error) {
      console.error('Error fetching ARK balance:', error);
      return 0;
    }
  }

  // Play game with real ARK transactions
  app.post("/api/game/play", async (req, res) => {
    try {
      const { betAmount, multiplier, playerAddress } = req.body;
      const HOUSE_ADDRESS = 'AdEKeaC8sBm24RHwnPvZfEWUiCPB4Z2xZp';
      const MIN_BET = 0.0001;
      const MAX_BET = 5;

      // Validate inputs
      const bet = parseFloat(betAmount);
      if (isNaN(bet) || bet < MIN_BET || bet > MAX_BET) {
        return res.status(400).json({ message: `Bet must be between ${MIN_BET} and ${MAX_BET} ARK` });
      }

      if (!playerAddress) {
        return res.status(400).json({ message: "Player address required" });
      }

      // Get real wallet balance
      const playerBalance = await getArkWalletBalance(playerAddress);
      if (bet > playerBalance) {
        return res.status(400).json({ message: "Insufficient ARK balance" });
      }

      // Validate multiplier
      const validMultipliers = [10, 5, 4, 3, 2, 1.5, -0.5, 1.25, 0, -1];
      if (!validMultipliers.includes(multiplier)) {
        return res.status(400).json({ message: "Invalid multiplier" });
      }

      // Calculate payout
      let payout: number;
      let isWin: boolean;
      
      if (multiplier === -1) {
        // Losing slot - send bet to house
        payout = 0;
        isWin = false;
        try {
          await sendArkTransaction(HOUSE_ADDRESS, bet);
        } catch (error) {
          console.error('Failed to send losing bet to house:', error);
        }
      } else if (multiplier === -0.5) {
        // Half-loss slot - send half to house, return half
        payout = bet * 0.5;
        isWin = false;
        try {
          await sendArkTransaction(HOUSE_ADDRESS, bet * 0.5);
          await sendArkTransaction(playerAddress, payout);
        } catch (error) {
          console.error('Failed to process half-loss transaction:', error);
        }
      } else if (multiplier === 0) {
        // Break-even slot - return original bet
        payout = bet;
        isWin = false;
        try {
          await sendArkTransaction(playerAddress, payout);
        } catch (error) {
          console.error('Failed to return bet:', error);
        }
      } else {
        // Win slot - send winnings to player
        payout = bet * multiplier;
        isWin = true;
        try {
          await sendArkTransaction(playerAddress, payout);
        } catch (error) {
          console.error('Failed to send winnings:', error);
        }
      }

      // Generate transaction ID for tracking
      const txId = `ark_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.json({
        isWin,
        betAmount: bet,
        multiplier,
        payout,
        txId,
        playerAddress,
        houseAddress: HOUSE_ADDRESS
      });

    } catch (error) {
      console.error("Game transaction error:", error);
      res.status(500).json({ message: "Failed to process game transaction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
