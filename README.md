# ARKlinko - Real ARK Blockchain Plinko Game

A provably fair cryptocurrency crash betting game on the ARK blockchain, delivering an engaging and interactive user experience with advanced blockchain interaction capabilities.

## Features

- **Real ARK Blockchain Integration**: Play with actual ARK cryptocurrency
- **ARK Connect Wallet Support**: Secure wallet connection via ARK Connect extension
- **Provably Fair Gaming**: Cryptographically secure game mechanics
- **Real-time Transactions**: Instant payouts to your wallet
- **Physics-based Gameplay**: Realistic ball physics and peg interactions
- **Responsive Design**: Works on desktop and mobile devices

## Game Rules

1. Connect your ARK wallet using ARK Connect extension
2. Set your bet amount (minimum 0.0001 ARK, maximum 5 ARK)
3. Click "Play" to drop the ball through the peg pyramid
4. Win multipliers based on which slot the ball lands in:
   - Edge slots: 110x multiplier
   - Near edge: 41x multiplier
   - Middle range: 10x, 5x, 3x multipliers

## Technical Stack

- **Frontend**: React with TypeScript, Vite, Tailwind CSS
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Blockchain**: ARK blockchain integration
- **Wallet**: ARK Connect extension support

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
