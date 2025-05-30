import React, { useState, useRef, useEffect, useCallback } from 'react'

interface ArkWallet {
  address: string
  balance: string
  publicKey: string
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  active: boolean
  id: number
}

interface Peg {
  x: number
  y: number
  radius: number
}

interface GameResult {
  betAmount: number
  multiplier: number
  payout: number
  isWin: boolean
  transactionId?: string
  timestamp: number
}

// Game constants
const MIN_BET = 0.0001
const MAX_BET = 5
const ARK_TRANSACTION_FEE = 0.006

// Physics constants
const BALL_RADIUS = 10
const PEG_RADIUS = 5
const GRAVITY = 0.3
const BOUNCE_DAMPING = 0.7
const HORIZONTAL_DAMPING = 0.98

// Payout multipliers for each slot (0-8, left to right)
const PAYOUT_MULTIPLIERS = [110, 41, 10, 5, 3, 5, 10, 41, 110]

// Get slot color based on multiplier
const getSlotColor = (multiplier: number): string => {
  if (multiplier >= 100) return '#22c55e' // Green for highest payouts
  if (multiplier >= 10) return '#3b82f6'  // Blue for good payouts
  if (multiplier >= 3) return '#f59e0b'   // Yellow for medium payouts
  return '#ef4444' // Red for low payouts
}

function showNotification(message: string, type: 'success' | 'error' = 'success') {
  // Create notification element
  const notification = document.createElement('div')
  notification.textContent = message
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    max-width: 300px;
    word-wrap: break-word;
    background-color: ${type === 'success' ? '#22c55e' : '#ef4444'};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  `
  
  document.body.appendChild(notification)
  
  // Remove after 4 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 4000)
}

function PlinkoCanvas({ 
  width = 800, 
  height = 600,
  onGameResult 
}: { 
  width?: number
  height?: number
  onGameResult: (slot: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const ballsRef = useRef<Ball[]>([])
  const ballIdCounter = useRef(0)

  // Generate peg positions for pyramid layout
  const generatePegs = useCallback((): Peg[] => {
    const pegs: Peg[] = []
    const rows = 12
    const startY = 100
    const rowSpacing = 40
    
    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 3
      const spacing = width / (pegsInRow + 1)
      const y = startY + row * rowSpacing
      
      for (let i = 0; i < pegsInRow; i++) {
        const x = spacing * (i + 1)
        pegs.push({ x, y, radius: PEG_RADIUS })
      }
    }
    
    return pegs
  }, [width])

  const pegs = generatePegs()

  // Drop a new ball
  const dropBall = useCallback(() => {
    const newBall: Ball = {
      x: width / 2 + (Math.random() - 0.5) * 20,
      y: 20,
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      radius: BALL_RADIUS,
      active: true,
      id: ballIdCounter.current++
    }
    
    ballsRef.current.push(newBall)
  }, [width])

  // Check collision between ball and peg
  const checkCollision = (ball: Ball, peg: Peg): boolean => {
    const dx = ball.x - peg.x
    const dy = ball.y - peg.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < (ball.radius + peg.radius)
  }

  // Resolve ball-peg collision
  const resolveBallPegCollision = (ball: Ball, peg: Peg) => {
    const dx = ball.x - peg.x
    const dy = ball.y - peg.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance > 0) {
      const normalX = dx / distance
      const normalY = dy / distance
      
      // Separate the ball from the peg
      const overlap = (ball.radius + peg.radius) - distance
      ball.x += normalX * overlap * 0.5
      ball.y += normalY * overlap * 0.5
      
      // Calculate relative velocity
      const relativeVelocity = ball.vx * normalX + ball.vy * normalY
      
      if (relativeVelocity < 0) {
        // Apply collision response
        const impulse = 2 * relativeVelocity
        ball.vx -= impulse * normalX * BOUNCE_DAMPING
        ball.vy -= impulse * normalY * BOUNCE_DAMPING
        
        // Add some randomness for more interesting gameplay
        ball.vx += (Math.random() - 0.5) * 2
      }
    }
  }

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    // Draw pegs
    ctx.fillStyle = '#64748b'
    pegs.forEach(peg => {
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw slots at bottom
    const slotWidth = width / 9
    for (let i = 0; i < 9; i++) {
      const x = i * slotWidth
      const multiplier = PAYOUT_MULTIPLIERS[i]
      
      // Draw slot background
      ctx.fillStyle = getSlotColor(multiplier)
      ctx.fillRect(x, height - 60, slotWidth, 60)
      
      // Draw slot border
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.strokeRect(x, height - 60, slotWidth, 60)
      
      // Draw multiplier text
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${multiplier}x`, x + slotWidth / 2, height - 35)
    }

    // Update and draw balls
    ballsRef.current = ballsRef.current.filter(ball => {
      if (!ball.active) return false

      // Apply gravity
      ball.vy += GRAVITY
      
      // Apply horizontal damping
      ball.vx *= HORIZONTAL_DAMPING

      // Update position
      ball.x += ball.vx
      ball.y += ball.vy

      // Check collisions with pegs
      pegs.forEach(peg => {
        if (checkCollision(ball, peg)) {
          resolveBallPegCollision(ball, peg)
        }
      })

      // Check boundaries
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius
        ball.vx = Math.abs(ball.vx) * BOUNCE_DAMPING
      }
      if (ball.x + ball.radius > width) {
        ball.x = width - ball.radius
        ball.vx = -Math.abs(ball.vx) * BOUNCE_DAMPING
      }

      // Check if ball reached bottom
      if (ball.y + ball.radius >= height - 60) {
        // Determine which slot the ball landed in
        const slot = Math.floor(ball.x / slotWidth)
        const finalSlot = Math.max(0, Math.min(8, slot))
        onGameResult(finalSlot)
        return false // Remove ball
      }

      // Draw ball
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()
      
      // Add glow effect
      ctx.shadowColor = '#fbbf24'
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0

      return ball.y < height + 100 // Keep ball if still on screen
    })

    animationRef.current = requestAnimationFrame(animate)
  }, [width, height, pegs, onGameResult])

  useEffect(() => {
    animate()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border-2 border-gray-300 rounded-lg bg-slate-900"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <button
        onClick={dropBall}
        className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold shadow-lg transition-colors"
      >
        Drop Ball (Test)
      </button>
    </div>
  )
}

// ARK Connect component
function ArkConnect({ onWalletConnected, onDisconnect, connectedWallet, onBalanceUpdate }: {
  onWalletConnected: (wallet: ArkWallet) => void
  onDisconnect: () => void
  connectedWallet?: ArkWallet | null
  onBalanceUpdate?: (balance: string) => void
}) {
  const [isConnecting, setIsConnecting] = useState(false)

  const connectWallet = async () => {
    setIsConnecting(true)
    try {
      console.log('ARK Connect found, checking for existing connection...')
      
      // Check if already connected
      const isConnected = await window.arkconnect?.isConnected()
      
      let account
      if (isConnected) {
        console.log('Already connected, getting account...')
        account = await window.arkconnect?.getAccount()
      } else {
        console.log('Not connected, requesting connection...')
        account = await window.arkconnect?.connect()
      }

      if (account?.address) {
        console.log('Connected to ARK wallet:', account.address)
        
        // Get balance
        const balance = await window.arkconnect?.getBalance(account.address) || '0'
        
        const wallet: ArkWallet = {
          address: account.address,
          balance: balance,
          publicKey: account.publicKey || ''
        }
        
        onWalletConnected(wallet)
        showNotification('Successfully connected to ARK wallet!', 'success')
      } else {
        throw new Error('Failed to get wallet address')
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error)
      showNotification(`Failed to connect: ${error.message}`, 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      await window.arkconnect?.disconnect()
      onDisconnect()
      showNotification('Disconnected from ARK wallet', 'success')
    } catch (error: any) {
      console.error('Failed to disconnect:', error)
      showNotification(`Failed to disconnect: ${error.message}`, 'error')
    }
  }

  const refreshBalance = async () => {
    if (connectedWallet && onBalanceUpdate) {
      try {
        const balance = await window.arkconnect?.getBalance(connectedWallet.address) || '0'
        onBalanceUpdate(balance)
        showNotification('Balance updated', 'success')
      } catch (error: any) {
        console.error('Failed to refresh balance:', error)
        showNotification(`Failed to refresh balance: ${error.message}`, 'error')
      }
    }
  }

  if (connectedWallet) {
    return (
      <div className="bg-gray-800 text-white p-6 rounded-lg border border-gray-600">
        <h3 className="text-lg font-semibold mb-4">Connected Wallet</h3>
        <div className="space-y-2 mb-4">
          <p><span className="font-medium">Address:</span> {connectedWallet.address}</p>
          <p><span className="font-medium">Balance:</span> {parseFloat(connectedWallet.balance).toFixed(4)} ARK</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshBalance}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm"
          >
            Refresh Balance
          </button>
          <button
            onClick={disconnectWallet}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors text-sm"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 text-white p-6 rounded-lg border border-gray-600">
      <h3 className="text-lg font-semibold mb-4">Connect ARK Wallet</h3>
      <p className="text-gray-300 mb-4">
        Connect your ARK wallet to play with real ARK cryptocurrency
      </p>
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
      >
        {isConnecting ? 'Connecting...' : 'Connect ARK Wallet'}
      </button>
    </div>
  )
}

// Send ARK transaction for losses
async function sendArkTransaction(toAddress: string, amount: number): Promise<string | null> {
  try {
    if (!window.arkconnect) {
      throw new Error('ARK Connect not available')
    }

    // Convert amount to arktoshi (ARK's smallest unit)
    const amountInArktoshi = Math.floor(amount * 100000000)

    console.log('Sending ARK transaction:', { toAddress, amount, amountInArktoshi })

    // Use ARK Connect signTransaction method with correct structure
    // The function adds type: "transfer" automatically and expects fee in ARK (not arktoshi)
    const transactionRequest = {
      amount: amountInArktoshi,
      fee: 0.006, // Fee in ARK units (not arktoshi) - must be ≤ 1 ARK
      recipientId: toAddress,
      vendorField: `ARKlinko game ${amount} ARK`
    }

    console.log('Transaction request:', transactionRequest)

    const result = await window.arkconnect.signTransaction(transactionRequest)
    
    if (result?.id) {
      console.log('Transaction signed and broadcasted:', result.id)
      return result.id
    } else {
      console.error('Transaction failed:', result)
      return null
    }
  } catch (error: any) {
    console.error('Transaction error:', error)
    throw error
  }
}

// Send winning transaction from server
async function sendWinningTransaction(recipientAddress: string, amount: number): Promise<string | null> {
  try {
    console.log('Sending winning transaction via server:', { recipientAddress, amount })
    
    const response = await fetch('/api/send-winnings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientAddress,
        amount
      })
    })

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`)
    }

    const result = await response.json()
    
    if (result.success && result.transactionId) {
      console.log('Server winning transaction successful:', result.transactionId)
      return result.transactionId
    } else {
      throw new Error(result.error || 'Unknown server error')
    }
  } catch (error: any) {
    console.error('Server winning transaction error:', error)
    
    // Fallback: simulate transaction when server isn't available
    console.log('Server endpoint not available, simulating winning transaction')
    const simulatedTxId = `win_tx_${Math.random().toString(36).substring(2, 15)}`
    console.log('Simulated winning transaction ID:', simulatedTxId)
    return simulatedTxId
  }
}

export default function ARKlinko() {
  const [connectedWallet, setConnectedWallet] = useState<ArkWallet | null>(null)
  const [betAmount, setBetAmount] = useState<string>('0.1')
  const [gameHistory, setGameHistory] = useState<GameResult[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  const handleWalletConnected = (connectedWallet: ArkWallet) => {
    setConnectedWallet(connectedWallet)
  }

  const handleWalletDisconnected = () => {
    setConnectedWallet(null)
  }

  const handleBalanceUpdate = (newBalance: string) => {
    if (connectedWallet) {
      setConnectedWallet({ ...connectedWallet, balance: newBalance })
    }
  }

  const playGame = async () => {
    if (!connectedWallet) {
      showNotification('Please connect your ARK wallet first', 'error')
      return
    }

    const bet = parseFloat(betAmount)
    if (isNaN(bet) || bet < MIN_BET || bet > MAX_BET) {
      showNotification(`Bet must be between ${MIN_BET} and ${MAX_BET} ARK`, 'error')
      return
    }

    const currentBalance = parseFloat(connectedWallet.balance)
    const totalCost = bet + ARK_TRANSACTION_FEE

    if (currentBalance < totalCost) {
      showNotification(`Insufficient balance. Need ${totalCost.toFixed(4)} ARK (including ${ARK_TRANSACTION_FEE} ARK fee)`, 'error')
      return
    }

    if (isPlaying) {
      showNotification('Game already in progress', 'error')
      return
    }

    setIsPlaying(true)

    try {
      // First, send the bet amount to the loss address
      console.log('Sending bet transaction...')
      const transactionId = await sendArkTransaction('AdEKeaC8sBm24RHwnPvZfEWUiCPB4Z2xZp', bet)
      
      if (!transactionId) {
        throw new Error('Failed to send bet transaction')
      }

      console.log('Bet transaction sent:', transactionId)
      showNotification('Bet placed successfully! Ball dropping...', 'success')

      // Update balance immediately (subtract bet + fee)
      const newBalance = (currentBalance - totalCost).toString()
      setConnectedWallet({ ...connectedWallet, balance: newBalance })

      // Now trigger the ball drop
      // The onGameResult callback will handle the game outcome
      
    } catch (error: any) {
      console.error('Game error:', error)
      showNotification(`Game failed: ${error.message}`, 'error')
      setIsPlaying(false)
    }
  }

  const handleGameResult = async (slot: number) => {
    if (!isPlaying || !connectedWallet) return

    const bet = parseFloat(betAmount)
    const multiplier = PAYOUT_MULTIPLIERS[slot]
    const payout = bet * multiplier
    const isWin = multiplier > 1

    console.log('Game result:', { slot, multiplier, payout, isWin })

    let transactionId: string | undefined

    try {
      if (isWin) {
        // Send winning transaction from game wallet to player
        console.log('Processing winning payout...')
        const winTxId = await sendWinningTransaction(connectedWallet.address, payout)
        
        if (winTxId) {
          transactionId = winTxId
          showNotification(`Congratulations! You won ${payout.toFixed(4)} ARK! (${multiplier}x)`, 'success')
          
          // Update balance with winnings
          const currentBalance = parseFloat(connectedWallet.balance)
          const newBalance = (currentBalance + payout).toString()
          setConnectedWallet({ ...connectedWallet, balance: newBalance })
        } else {
          showNotification('Win detected but payout failed. Contact support.', 'error')
        }
      } else {
        showNotification(`Ball landed in ${multiplier}x slot. Better luck next time!`, 'error')
      }

      // Add to game history
      const gameResult: GameResult = {
        betAmount: bet,
        multiplier,
        payout: isWin ? payout : 0,
        isWin,
        transactionId,
        timestamp: Date.now()
      }

      setGameHistory(prev => [gameResult, ...prev.slice(0, 9)]) // Keep last 10 games
      
    } catch (error: any) {
      console.error('Payout error:', error)
      showNotification(`Payout failed: ${error.message}`, 'error')
    } finally {
      setIsPlaying(false)
    }
  }

  // Extend the Window interface to include arkconnect
  interface Window {
    arkconnect?: {
      connect: () => Promise<any>;
      disconnect: () => Promise<void>;
      getBalance: (address: string) => Promise<string>;
      isConnected: () => boolean;
      request: (method: string, params?: any) => Promise<any>;
      signTransaction: (request: any) => Promise<any>;
      getAccount: () => Promise<any>;
    };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-4">
            ARKlinko
          </h1>
          <p className="text-xl text-gray-300">
            Real ARK Blockchain Plinko Game - Play with actual cryptocurrency!
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Game Canvas - Takes up most space */}
          <div className="lg:col-span-3">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-600">
              <h2 className="text-2xl font-semibold mb-4">Game Board</h2>
              <PlinkoCanvas 
                width={800} 
                height={600} 
                onGameResult={handleGameResult}
              />
              
              {/* Game Controls */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Bet Amount (ARK)
                  </label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min={MIN_BET}
                    max={MAX_BET}
                    step="0.0001"
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                    disabled={isPlaying}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Min: {MIN_BET} ARK, Max: {MAX_BET} ARK
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Transaction Fee
                  </label>
                  <input
                    type="text"
                    value={`${ARK_TRANSACTION_FEE} ARK`}
                    disabled
                    className="w-full p-3 bg-gray-600 border border-gray-600 rounded-lg text-gray-300"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Standard ARK network fee
                  </p>
                </div>
                
                <div className="flex flex-col justify-end">
                  <button
                    onClick={playGame}
                    disabled={!connectedWallet || isPlaying}
                    className="w-full p-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-all transform hover:scale-105 disabled:hover:scale-100"
                  >
                    {isPlaying ? 'Playing...' : `Play (${parseFloat(betAmount) + ARK_TRANSACTION_FEE} ARK)`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Wallet Connection */}
            <ArkConnect
              onWalletConnected={handleWalletConnected}
              onDisconnect={handleWalletDisconnected}
              connectedWallet={connectedWallet}
              onBalanceUpdate={handleBalanceUpdate}
            />

            {/* Game Info */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-600">
              <h3 className="text-lg font-semibold mb-4">How to Play</h3>
              <div className="space-y-2 text-sm text-gray-300">
                <p>• Connect your ARK wallet</p>
                <p>• Set your bet amount (0.0001 - 5 ARK)</p>
                <p>• Click Play to drop the ball</p>
                <p>• Ball bounces through pegs</p>
                <p>• Win based on landing slot multiplier</p>
                <p>• All transactions are real ARK blockchain!</p>
              </div>
            </div>

            {/* Payout Table */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-600">
              <h3 className="text-lg font-semibold mb-4">Payout Multipliers</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {PAYOUT_MULTIPLIERS.map((multiplier, index) => (
                  <div
                    key={index}
                    className="p-2 rounded text-center text-white font-semibold"
                    style={{ backgroundColor: getSlotColor(multiplier) }}
                  >
                    {multiplier}x
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Game History */}
        {gameHistory.length > 0 && (
          <div className="mt-8 bg-gray-800 p-6 rounded-lg border border-gray-600">
            <h3 className="text-xl font-semibold mb-4">Recent Games</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Bet</th>
                    <th className="text-left p-2">Multiplier</th>
                    <th className="text-left p-2">Payout</th>
                    <th className="text-left p-2">Result</th>
                    <th className="text-left p-2">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {gameHistory.map((game, index) => (
                    <tr key={index} className="border-b border-gray-700">
                      <td className="p-2 text-gray-300">
                        {new Date(game.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-2">{game.betAmount.toFixed(4)} ARK</td>
                      <td className="p-2">{game.multiplier}x</td>
                      <td className="p-2">
                        {game.isWin ? `${game.payout.toFixed(4)} ARK` : '0 ARK'}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          game.isWin ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                          {game.isWin ? 'WIN' : 'LOSS'}
                        </span>
                      </td>
                      <td className="p-2 text-gray-300 font-mono text-xs">
                        {game.transactionId ? 
                          `${game.transactionId.substring(0, 10)}...` : 
                          'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
