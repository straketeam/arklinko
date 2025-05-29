import React, { useState, useRef, useEffect, useCallback } from 'react'

interface ArkWallet {
  address: string
  balance: string
  network: string
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

// Plinko game physics constants
const BALL_RADIUS = 10
const PEG_RADIUS = 5
const GRAVITY = 0.3
const BOUNCE_DAMPING = 0.7
const HORIZONTAL_DAMPING = 0.98
const ROWS = 16

// Plinko multipliers (from left to right) - center losing, sides break-even
const MULTIPLIERS = [10, 5, 4, 3, 2, -0.5, 1.5, 1.25, 0, -1, 0, 1.25, 1.5, -0.5, 2, 3, 4, 5, 10]

function PlinkoCanvas({ 
  onBallLanded, 
  triggerDrop, 
  onTriggerComplete 
}: { 
  onBallLanded: (multiplier: number) => void
  triggerDrop: boolean
  onTriggerComplete: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballsRef = useRef<Ball[]>([])
  const pegsRef = useRef<Peg[]>([])
  const animationRef = useRef<number>()
  const ballIdRef = useRef(0)

  // Initialize pegs
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pegs: Peg[] = []
    
    // Much larger canvas dimensions for prominent web game feel
    const canvasWidth = 1400
    const canvasHeight = 900
    
    // Define play area - above multiplier boxes
    const playAreaTop = 100
    const playAreaBottom = canvasHeight - 100 // Leave space for multipliers
    const playAreaLeft = 70
    const playAreaRight = canvasWidth - 70
    const playAreaWidth = playAreaRight - playAreaLeft
    const playAreaHeight = playAreaBottom - playAreaTop
    
    // Create 20 rows of pegs for even denser board
    const numRows = 20
    
    for (let row = 0; row < numRows; row++) {
      // Y position spreads evenly from top to bottom of play area
      const y = playAreaTop + (row * (playAreaHeight / (numRows - 1)))
      
      // Number of pegs increases from top (6) to bottom (19 to match multiplier slots)
      const pegsInRow = 6 + Math.floor((row / (numRows - 1)) * 13)
      
      // X positions spread evenly across full width
      for (let col = 0; col < pegsInRow; col++) {
        // Calculate X position to distribute across entire width
        let x
        if (pegsInRow === 1) {
          x = canvasWidth / 2 // Center single peg
        } else {
          x = playAreaLeft + (col * (playAreaWidth / (pegsInRow - 1)))
        }
        
        // Offset alternate rows for zigzag pattern
        if (row % 2 === 1) {
          x += (playAreaWidth / (pegsInRow - 1)) / 2
        }
        
        // Only add if within canvas bounds
        if (x >= playAreaLeft && x <= playAreaRight) {
          pegs.push({
            x: x,
            y: y,
            radius: PEG_RADIUS
          })
        }
      }
    }

    pegsRef.current = pegs
  }, [])

  // Drop ball when triggered
  useEffect(() => {
    if (triggerDrop) {
      try {
        const canvas = canvasRef.current
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          const newBall: Ball = {
            x: canvas.width / 2 + (Math.random() - 0.5) * 30,
            y: 60,
            vx: (Math.random() - 0.5) * 2,
            vy: 0,
            radius: BALL_RADIUS,
            active: true,
            id: ballIdRef.current++
          }
          ballsRef.current.push(newBall)
        }
        onTriggerComplete()
      } catch (error) {
        console.error('Error dropping ball:', error)
        onTriggerComplete()
      }
    }
  }, [triggerDrop, onTriggerComplete])

  const checkCollision = (ball: Ball, peg: Peg): boolean => {
    const dx = ball.x - peg.x
    const dy = ball.y - peg.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < ball.radius + peg.radius
  }

  const resolveBallPegCollision = (ball: Ball, peg: Peg) => {
    const dx = ball.x - peg.x
    const dy = ball.y - peg.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance > 0) {
      const overlap = ball.radius + peg.radius - distance
      const separationX = (dx / distance) * overlap * 0.5
      const separationY = (dy / distance) * overlap * 0.5
      
      ball.x += separationX
      ball.y += separationY
      
      const normalX = dx / distance
      const normalY = dy / distance
      const velDotNormal = ball.vx * normalX + ball.vy * normalY
      
      ball.vx -= 2 * velDotNormal * normalX * BOUNCE_DAMPING
      ball.vy -= 2 * velDotNormal * normalY * BOUNCE_DAMPING
      
      ball.vx += (Math.random() - 0.5) * 1
    }
  }

  const updatePhysics = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    ballsRef.current.forEach((ball, index) => {
      if (!ball.active) return

      ball.vy += GRAVITY
      ball.vx *= HORIZONTAL_DAMPING
      
      ball.x += ball.vx
      ball.y += ball.vy

      pegsRef.current.forEach(peg => {
        if (checkCollision(ball, peg)) {
          resolveBallPegCollision(ball, peg)
        }
      })

      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius
        ball.vx = -ball.vx * BOUNCE_DAMPING
      }
      if (ball.x + ball.radius > canvas.width) {
        ball.x = canvas.width - ball.radius
        ball.vx = -ball.vx * BOUNCE_DAMPING
      }

      if (ball.y > canvas.height - 80) {
        ball.active = false
        
        const slotWidth = canvas.width / MULTIPLIERS.length
        const slotIndex = Math.floor(ball.x / slotWidth)
        const finalIndex = Math.max(0, Math.min(MULTIPLIERS.length - 1, slotIndex))
        
        onBallLanded(MULTIPLIERS[finalIndex])
        
        setTimeout(() => {
          ballsRef.current.splice(index, 1)
        }, 1000)
      }
    })
  }

  const draw = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return

    try {
      // Dark background
      ctx.fillStyle = '#111827'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw pegs with better visibility
      ctx.fillStyle = '#9ca3af'
      pegsRef.current.forEach(peg => {
        ctx.beginPath()
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Add glow effect
        ctx.shadowColor = '#9ca3af'
        ctx.shadowBlur = 3
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // Draw multiplier slots at bottom
      const slotWidth = canvas.width / MULTIPLIERS.length
      MULTIPLIERS.forEach((multiplier, index) => {
        const x = index * slotWidth
        const y = canvas.height - 70
        
        // Color slots based on type
        let slotColor
        if (multiplier === -1) {
          slotColor = '#dc2626' // Red for losing slot (center)
        } else if (multiplier === -0.5) {
          slotColor = '#dc2626' // Red for half-loss slots
        } else if (multiplier === 0) {
          slotColor = '#6b7280' // Gray for break-even slots
        } else if (multiplier >= 10) {
          slotColor = '#16a34a' // Green for high multipliers
        } else if (multiplier >= 3) {
          slotColor = '#2563eb' // Blue for medium-high
        } else if (multiplier >= 1.5) {
          slotColor = '#ca8a04' // Yellow for medium
        } else {
          slotColor = '#ca8a04' // Yellow for low
        }
        
        ctx.fillStyle = slotColor
        ctx.fillRect(x, y, slotWidth, 70)
        
        ctx.strokeStyle = '#374151'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, slotWidth, 70)
        
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px monospace'
        ctx.textAlign = 'center'
        
        // Display different symbols for different slot types
        if (multiplier === -1) {
          ctx.font = 'bold 24px monospace'
          ctx.fillText('☠️', x + slotWidth / 2, y + 45)
        } else if (multiplier === 0) {
          ctx.fillText('0x', x + slotWidth / 2, y + 40)
        } else if (multiplier === -0.5) {
          ctx.fillText('-0.5x', x + slotWidth / 2, y + 40)
        } else {
          ctx.fillText(`${multiplier}x`, x + slotWidth / 2, y + 40)
        }
      })

      // Draw balls with enhanced visuals
      ballsRef.current.forEach(ball => {
        if (!ball.active) return
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.beginPath()
        ctx.arc(ball.x + 3, ball.y + 3, ball.radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Main ball
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Highlight
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(ball.x - 3, ball.y - 3, ball.radius / 2, 0, Math.PI * 2)
        ctx.fill()
      })
    } catch (error) {
      console.error('Canvas drawing error:', error)
    }
  }

  const animate = () => {
    updatePhysics()
    draw()
    animationRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = 1400
    canvas.height = 900
    
    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full bg-gray-900 rounded-xl border-2 border-gray-600 shadow-2xl"
      style={{ width: '100%', height: 'auto', aspectRatio: '14/9' }}
    />
  )
}

function App() {
  const [wallet, setWallet] = useState<ArkWallet | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [betAmount, setBetAmount] = useState("1.00")
  const betAmountRef = useRef("1.00")
  const [gameState, setGameState] = useState<"idle" | "playing" | "finished">("idle")
  const [triggerDrop, setTriggerDrop] = useState(false)
  const [lastMultiplier, setLastMultiplier] = useState<number | null>(null)
  const [gameHistory, setGameHistory] = useState<Array<{id: number, bet: number, multiplier: number, payout: number}>>([])
  const [nextGameId, setNextGameId] = useState(1)

  useEffect(() => {
    const checkConnection = async () => {
      if (window.arkconnect) {
        try {
          const isConnected = await window.arkconnect.isConnected()
          if (isConnected) {
            await loadWalletData()
          }
        } catch (error: any) {
          console.error('Error checking connection:', error.message)
        }
      }
    }
    
    const loadWalletData = async () => {
      try {
        const address = await window.arkconnect!.getAddress()
        const balance = await window.arkconnect!.getBalance()
        const network = await window.arkconnect!.getNetwork()
        
        setWallet({ address, balance, network })
      } catch (error: any) {
        console.error('Error loading wallet data:', error.message)
      }
    }
    
    if (window.arkconnect) {
      window.arkconnect.on?.('connected', loadWalletData)
      window.arkconnect.on?.('disconnected', () => setWallet(null))
      window.arkconnect.on?.('addressChanged', loadWalletData)
    }
    
    setTimeout(checkConnection, 1000)
  }, [])

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      if (!window.arkconnect) {
        throw new Error('ARK Connect extension not found')
      }
      
      await window.arkconnect.connect()
      
      const address = await window.arkconnect.getAddress()
      const balance = await window.arkconnect.getBalance()
      const network = await window.arkconnect.getNetwork()
      
      setWallet({ address, balance, network })
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      if (window.arkconnect) {
        await window.arkconnect.disconnect()
      }
    } catch (error: any) {
      console.error('Disconnect error:', error.message)
    }
  }

  const handlePlay = () => {
    if (!wallet) return
    
    const bet = parseFloat(betAmount)
    if (isNaN(bet) || bet < 0.01 || bet > 5) {
      return
    }
    
    setGameState("playing")
    setLastMultiplier(null)
    setTriggerDrop(true)
  }

  const handleBallLanded = useCallback((multiplier: number) => {
    const currentBetAmount = betAmountRef.current
    const bet = parseFloat(currentBetAmount)
    const payout = bet * multiplier
    
    setLastMultiplier(multiplier)
    setGameState("finished")
    
    setGameHistory(prev => [{
      id: nextGameId,
      bet,
      multiplier,
      payout
    }, ...prev.slice(0, 9)])
    
    setNextGameId(prev => prev + 1)
  }, [nextGameId])

  const handleTriggerComplete = () => {
    setTriggerDrop(false)
  }

  const handleNewGame = () => {
    setGameState("idle")
    setLastMultiplier(null)
  }

  const handleBetAmountChange = (value: string) => {
    setBetAmount(value)
    betAmountRef.current = value
  }

  declare global {
    interface Window {
      arkconnect?: {
        connect: () => Promise<void>
        disconnect: () => Promise<void>
        getAddress: () => Promise<string>
        getBalance: () => Promise<string>
        getNetwork: () => Promise<string>
        isConnected: () => Promise<boolean>
        version: () => string
        signMessage: (request: any) => Promise<any>
        signTransaction: (request: any) => Promise<any>
        signVote: (request: any) => Promise<any>
        on?: (event: string, callback: (data: any) => void) => void
      }
    }
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">A</span>
              </div>
              <h1 className="text-4xl font-bold text-white">ARKlinko</h1>
            </div>
            <p className="text-gray-300">Connect your ARK wallet to play</p>
          </div>
          
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 p-4 rounded mb-4">
              <p className="font-semibold">Connection Error:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect ARK Wallet'}
          </button>
          
          <div className="text-xs text-gray-500 text-center mt-4">
            <p>Requires ARK Connect browser extension</p>
            <p>Download from <a href="https://arkconnect.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">arkconnect.io</a></p>
          </div>
        </div>
      </div>
    )
  }

  const canPlay = gameState === "idle" && wallet && betAmount && parseFloat(betAmount) >= 0.01 && parseFloat(betAmount) <= 5
  const payout = lastMultiplier ? (parseFloat(betAmount) * lastMultiplier).toFixed(8) : "0"

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header with ARK Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="w-20 h-20 bg-red-500 rounded-xl flex items-center justify-center shadow-2xl">
              <span className="text-white font-bold text-3xl">A</span>
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-red-400 via-red-500 to-red-600 bg-clip-text text-transparent">
              ARKlinko
            </h1>
          </div>
          <p className="text-gray-400 text-xl">Drop the ball and watch it bounce through the pegs!</p>
        </div>

        {/* Wallet Info Section */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-400">Connected Wallet</p>
                <p className="font-mono text-lg">{wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}</p>
              </div>
              <div className="w-px h-12 bg-gray-600"></div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Balance</p>
                <p className="text-2xl font-bold text-green-400">{parseFloat(wallet.balance).toFixed(8)} ARK</p>
              </div>
              <div className="w-px h-12 bg-gray-600"></div>
              <div className="text-center">
                <button 
                  onClick={disconnectWallet}
                  className="border border-red-600 text-red-400 hover:bg-red-600 hover:text-white px-4 py-2 rounded text-sm"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Game Canvas - Full Width */}
        <div className="mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8">
            <PlinkoCanvas 
              onBallLanded={handleBallLanded}
              triggerDrop={triggerDrop}
              onTriggerComplete={handleTriggerComplete}
            />
          </div>
        </div>

        {/* Bet Controls Section - Under Game */}
        <div className="mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-6 text-center">Game Controls</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg text-gray-400 mb-3">Bet Amount (ARK)</label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => handleBetAmountChange(e.target.value)}
                  placeholder="1.00"
                  min="0.01"
                  max="5"
                  step="0.01"
                  className="w-full bg-gray-700 text-white p-4 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-lg"
                />
                <div className="text-sm text-gray-400 mt-2">
                  <p>Min bet: 0.01 ARK • Max bet: 5.00 ARK</p>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <button
                  onClick={handlePlay}
                  disabled={!canPlay || gameState === "playing"}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-4 px-6 rounded-lg font-bold text-xl mb-4"
                >
                  {gameState === "playing" ? "Ball Dropping..." : "🎯 Drop Ball"}
                </button>

                {gameState === "finished" && (
                  <div className="p-4 bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-400">Last Result:</p>
                    <p className="text-xl font-bold">
                      {lastMultiplier}x multiplier
                    </p>
                    <p className="text-lg">
                      Payout: {payout} ARK
                    </p>
                    <button
                      onClick={handleNewGame}
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
                    >
                      Play Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Game History Section - Under Everything */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-2xl font-bold mb-6 text-center">Recent Games</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gameHistory.length === 0 ? (
                <div className="col-span-full text-center">
                  <p className="text-gray-400 text-lg">No games played yet</p>
                </div>
              ) : (
                gameHistory.map((game) => (
                  <div key={game.id} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold">Game #{game.id}</span>
                      <span className={game.payout > game.bet ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {game.payout > game.bet ? '+' : ''}{(game.payout - game.bet).toFixed(2)} ARK
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Bet: {game.bet} ARK • {game.multiplier}x • Payout: {game.payout.toFixed(2)} ARK
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
