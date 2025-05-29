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
const BALL_RADIUS = 8
const PEG_RADIUS = 4
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
    
    // Use fixed canvas dimensions that match typical game size
    const canvasWidth = 800
    const canvasHeight = 600
    
    // Define play area - above multiplier boxes
    const playAreaTop = 80
    const playAreaBottom = canvasHeight - 80 // Leave space for multipliers
    const playAreaLeft = 50
    const playAreaRight = canvasWidth - 50
    const playAreaWidth = playAreaRight - playAreaLeft
    const playAreaHeight = playAreaBottom - playAreaTop
    
    // Create 18 rows of pegs spanning the entire play area for denser board
    const numRows = 18
    
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
            x: canvas.width / 2 + (Math.random() - 0.5) * 20,
            y: 50,
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

      if (ball.y > canvas.height - 60) {
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
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#6b7280'
      pegsRef.current.forEach(peg => {
        ctx.beginPath()
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      const slotWidth = canvas.width / MULTIPLIERS.length
      MULTIPLIERS.forEach((multiplier, index) => {
        const x = index * slotWidth
        const y = canvas.height - 50
        
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
        ctx.fillRect(x, y, slotWidth, 50)
        
        ctx.strokeStyle = '#374151'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, slotWidth, 50)
        
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        
        // Display different symbols for different slot types
        if (multiplier === -1) {
          ctx.font = 'bold 18px monospace'
          ctx.fillText('☠️', x + slotWidth / 2, y + 32)
        } else if (multiplier === 0) {
          ctx.fillText('0x', x + slotWidth / 2, y + 30)
        } else if (multiplier === -0.5) {
          ctx.fillText('-0.5x', x + slotWidth / 2, y + 30)
        } else {
          ctx.fillText(`${multiplier}x`, x + slotWidth / 2, y + 30)
        }
      })

      ballsRef.current.forEach(ball => {
        if (!ball.active) return
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.beginPath()
        ctx.arc(ball.x + 2, ball.y + 2, ball.radius, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(ball.x - 2, ball.y - 2, ball.radius / 3, 0, Math.PI * 2)
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

    canvas.width = 800
    canvas.height = 600
    
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
      className="w-full max-w-4xl mx-auto bg-gray-800 rounded-lg border border-gray-600 shadow-xl"
      style={{ width: '100%', height: 'auto', aspectRatio: '4/3' }}
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
          <h1 className="text-3xl font-bold text-white mb-6 text-center">ARKlinko</h1>
          <p className="text-gray-300 mb-6 text-center">Connect your ARK wallet to play</p>
          
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent mb-4">
            ARKlinko
          </h1>
          <p className="text-gray-400">Drop the ball and watch it bounce through the pegs!</p>
        </div>

        {/* Wallet Info Section */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-400">Connected Wallet</p>
                <p className="font-mono text-sm">{wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}</p>
              </div>
              <div className="w-px h-8 bg-gray-600"></div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Balance</p>
                <p className="text-lg font-bold text-green-400">{parseFloat(wallet.balance).toFixed(8)} ARK</p>
              </div>
              <div className="w-px h-8 bg-gray-600"></div>
              <div className="text-center">
                <button 
                  onClick={disconnectWallet}
                  className="border border-red-600 text-red-400 hover:bg-red-600 hover:text-white px-3 py-1 rounded text-sm"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Game Controls */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Game Controls</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Bet Amount (ARK)</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => handleBetAmountChange(e.target.value)}
                placeholder="1.00"
                min="0.01"
                max="5"
                step="0.01"
                className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="text-sm text-gray-400 mb-4">
              <p>Min bet: 0.01 ARK</p>
              <p>Max bet: 5.00 ARK</p>
            </div>

            <button
              onClick={handlePlay}
              disabled={!canPlay || gameState === "playing"}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-bold"
            >
              {gameState === "playing" ? "Ball Dropping..." : "Drop Ball"}
            </button>

            {gameState === "finished" && (
              <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-400">Last Result:</p>
                <p className="text-lg font-bold">
                  {lastMultiplier}x multiplier
                </p>
                <p className="text-sm">
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

          {/* Game Canvas */}
          <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-lg p-6">
            <PlinkoCanvas 
              onBallLanded={handleBallLanded}
              triggerDrop={triggerDrop}
              onTriggerComplete={handleTriggerComplete}
            />
          </div>

          {/* Game History */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Recent Games</h3>
            <div className="space-y-2">
              {gameHistory.length === 0 ? (
                <p className="text-gray-400 text-sm">No games played yet</p>
              ) : (
                gameHistory.map((game) => (
                  <div key={game.id} className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between text-sm">
                      <span>Game #{game.id}</span>
                      <span className={game.payout > game.bet ? 'text-green-400' : 'text-red-400'}>
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
