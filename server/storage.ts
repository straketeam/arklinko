import {
  users,
  games,
  transactions,
  seeds,
  type User,
  type Game,
  type Transaction,
  type Seed,
  type InsertUser,
  type InsertGame,
  type InsertTransaction,
  type InsertSeed,
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByArkAddress(arkAddress: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(id: number, balance: string): Promise<User | undefined>;

  // Games
  getGame(id: number): Promise<Game | undefined>;
  getGamesByUserId(userId: number, limit?: number): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;

  // Transactions
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactionsByUserId(userId: number, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;

  // Seeds
  getActiveSeed(userId: number): Promise<Seed | undefined>;
  createSeed(seed: InsertSeed): Promise<Seed>;
  updateSeed(id: number, seed: Partial<InsertSeed>): Promise<Seed | undefined>;
}

// Generate ARK wallet for demo user
function generateArkWallet() {
  // Use a deterministic seed for demo purposes
  const addresses = [
    "AUDud8tvyVZa67p3QY7XPRUTjRGnWQQ9Xv",
    "AQVYdXMzDBm4VCqnKXhRJm4RFpqvk3WF7v",
    "ARNJJruY6RcuYCXcwWsu4bx9kyZtntqeAx"
  ];
  
  const randomIndex = Math.floor(Math.random() * addresses.length);
  return {
    address: addresses[randomIndex],
    balance: "10.0"
  };
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private games: Map<number, Game>;
  private transactions: Map<number, Transaction>;
  private seeds: Map<number, Seed>;
  private currentUserId: number;
  private currentGameId: number;
  private currentTransactionId: number;
  private currentSeedId: number;

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.transactions = new Map();
    this.seeds = new Map();
    this.currentUserId = 1;
    this.currentGameId = 1;
    this.currentTransactionId = 1;
    this.currentSeedId = 1;
    
    // Initialize demo data
    this.initializeDemoData();
  }

  private async initializeDemoData() {
    const wallet = generateArkWallet();
    
    const demoUser: User = {
      id: 1,
      username: "demo_player",
      email: "demo@arklinko.com",
      arkAddress: wallet.address,
      balance: wallet.balance,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(1, demoUser);
    this.currentUserId = 2;

    const seed: Seed = {
      id: 1,
      userId: 1,
      serverSeed: "demo_server_seed_" + Math.random().toString(36).substring(7),
      clientSeed: "demo_client_seed",
      nonce: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.seeds.set(1, seed);
    this.currentSeedId = 2;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async getUserByArkAddress(arkAddress: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.arkAddress === arkAddress) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = { 
      id: this.currentUserId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...insertUser 
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUserBalance(id: number, balance: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      user.balance = balance;
      user.updatedAt = new Date();
      this.users.set(id, user);
      return user;
    }
    return undefined;
  }

  async getGame(id: number): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async getGamesByUserId(userId: number, limit = 50): Promise<Game[]> {
    const userGames = Array.from(this.games.values())
      .filter(game => game.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return userGames;
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const game: Game = { 
      id: this.currentGameId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...insertGame 
    };
    this.games.set(game.id, game);
    return game;
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionsByUserId(userId: number, limit = 50): Promise<Transaction[]> {
    const userTransactions = Array.from(this.transactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return userTransactions;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const transaction: Transaction = { 
      id: this.currentTransactionId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...insertTransaction 
    };
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async updateTransaction(id: number, update: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (transaction) {
      Object.assign(transaction, update);
      transaction.updatedAt = new Date();
      this.transactions.set(id, transaction);
      return transaction;
    }
    return undefined;
  }

  async getActiveSeed(userId: number): Promise<Seed | undefined> {
    for (const seed of this.seeds.values()) {
      if (seed.userId === userId && seed.isActive) {
        return seed;
      }
    }
    return undefined;
  }

  async createSeed(insertSeed: InsertSeed): Promise<Seed> {
    const seed: Seed = { 
      id: this.currentSeedId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...insertSeed 
    };
    this.seeds.set(seed.id, seed);
    return seed;
  }

  async updateSeed(id: number, update: Partial<InsertSeed>): Promise<Seed | undefined> {
    const seed = this.seeds.get(id);
    if (seed) {
      Object.assign(seed, update);
      seed.updatedAt = new Date();
      this.seeds.set(id, seed);
      return seed;
    }
    return undefined;
  }
}

export const storage = process.env.NODE_ENV === 'production' 
  ? new MemStorage() // Use memory storage for now
  : new MemStorage();
