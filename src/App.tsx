import React, { useState, useEffect, useRef } from 'react'

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

const MULTIPLIERS = [0.2, 0.5, 1, 2, 5, 10, 5, 2, 1, 0.5, 0.2]

function PlinkoCanvas({ 
  onBallComplete, 
  gameWidth = 600, 
  gameHeight = 500 
}: { 
  onBallComplete: (multiplier: number) => void
  gameWidth?: number
  gameHeight?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballsRef = useRef<Ball[]>([])
  const pegsRef = useRef<Peg[]>([])
  const animationRef = useRef<number>()
  const ballIdRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Initialize pegs in pyramid formation
    const pegRadius = 4
    const rows = 12
    const pegSpacing = 45
    const startY = 80

    pegsRef.current = []
    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 3
      const rowWidth = (pegsInRow - 1) * pegSpacing
      const startX = (gameWidth - rowWidth) / 2

      for (let col = 0; col < pegsInRow; col++) {
        pegsRef.current.push({
          x: startX + col * pegSpacing,
          y: startY + row * 35,
          radius: pegRadius
        })
      }
    }

    const gameLoop = () => {
      ctx.clearRect(0, 0, gameWidth, gameHeight)

      // Draw pegs
      ctx.fillStyle = '#ffffff'
      pegsRef.current.forEach(peg => {
        ctx.beginPath()
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw bottom boxes with multipliers
      const boxWidth = gameWidth / MULTIPLIERS.length
      MULTIPLIERS.forEach((multiplier, index) => {
        const x = index * boxWidth
        const y = gameHeight - 40
        
        // Color based on multiplier value
        if (multiplier >= 5) {
          ctx.fillStyle = '#22c55e' // Green for high multipliers
        } else if (multiplier >= 2) {
          ctx.fillStyle = '#3b82f6' // Blue for medium multipliers
        } else {
          ctx.fillStyle = '#ef4444' // Red for low multipliers
        }
        
        ctx.fillRect(x, y, boxWidth, 40)
        
        // Multiplier text
        ctx.fillStyle = '#ffffff'
        ctx.font = '14px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`${multiplier}x`, x + boxWidth / 2, y + 25)
      })

      // Update and draw balls
      ballsRef.current.forEach((ball, index) => {
        if (!ball.active) return

        // Apply gravity
        ball.vy += 0.3

        // Update position
        ball.x += ball.vx
        ball.y += ball.vy

        // Check collision with pegs
        pegsRef.current.forEach(peg => {
          const dx = ball.x - peg.x
          const dy = ball.y - peg.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < ball.radius + peg.radius) {
            // Collision detected
            const angle = Math.atan2(dy, dx)
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
            
            ball.vx = Math.cos(angle) * speed * 0.7 + (Math.random() - 0.5) * 2
            ball.vy = Math.sin(angle) * speed * 0.7

            // Separate ball from peg
            ball.x = peg.x + Math.cos(angle) * (ball.radius + peg.radius)
            ball.y = peg.y + Math.sin(angle) * (ball.radius + peg.radius)
          }
        })

        // Check if ball reached bottom
        if (ball.y > gameHeight - 40) {
          const boxIndex = Math.floor(ball.x / (gameWidth / MULTIPLIERS.length))
          const clampedIndex = Math.max(0, Math.min(MULTIPLIERS.length - 1, boxIndex))
          onBallComplete(MULTIPLIERS[clampedIndex])
          ball.active = false
        }

        // Keep ball in bounds
        if (ball.x < ball.radius || ball.x > gameWidth - ball.radius) {
          ball.vx *= -0.8
          ball.x = Math.max(ball.radius, Math.min(gameWidth - ball.radius, ball.x))
        }

        // Draw ball
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      // Remove inactive balls
      ballsRef.current = ballsRef.current.filter(ball => ball.active)

      animationRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoop()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [onBallComplete, gameWidth, gameHeight])

  const dropBall = () => {
    const newBall: Ball = {
      x: gameWidth / 2 + (Math.random() - 0.5) * 20,
      y: 20,
      vx: (Math.random() - 0.5) * 1,
      vy: 0,
      radius: 6,
      active: true,
      id: ballIdRef.current++
    }
    ballsRef.current.push(newBall)
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={gameWidth}
        height={gameHeight}
        className="border border-gray-600 rounded-lg bg-gray-800"
      />
      <button
        onClick={dropBall}
        className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-bold"
      >
        Drop Ball
      </button>
    </div>
  )
}

function App() {
  const [wallet, setWallet] = useState<ArkWallet | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [betAmount, setBetAmount] = useState('')
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

  const handleBallComplete = (multiplier: number) => {
    const bet = parseFloat(betAmount) || 0
    const payout = bet * multiplier
    
    setGameHistory(prev => [{
      id: nextGameId,
      bet,
      multiplier,
      payout
    }, ...prev.slice(0, 9)])
    
    setNextGameId(prev => prev + 1)
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">ARKlinko</h1>
          <p className="text-gray-300">Provably Fair Plinko Game</p>
        </header>
        
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <p className="text-sm">Connected: {wallet.address}</p>
          <p className="text-sm">Balance: {wallet.balance} ARK</p>
          <p className="text-sm">Network: {wallet.network}</p>
          <button 
            onClick={disconnectWallet}
            className="text-red-400 text-sm hover:text-red-300 mt-2"
          >
            Disconnect
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Game Controls */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4">Game Controls</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">Bet Amount (ARK)</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="text-sm text-gray-400 mb-4">
              <p>Min bet: 0.01 ARK</p>
              <p>Max bet: 100 ARK</p>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Multipliers</h4>
              <div className="grid grid-cols-11 gap-1 text-xs">
                {MULTIPLIERS.map((mult, i) => (
                  <div key={i} className={`text-center p-1 rounded ${
                    mult >= 5 ? 'bg-green-600' : mult >= 2 ? 'bg-blue-600' : 'bg-red-600'
                  }`}>
                    {mult}x
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Game Canvas */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <PlinkoCanvas onBallComplete={handleBallComplete} />
          </div>

          {/* Game History */}
          <div className="bg-gray-800 p-6 rounded-lg">
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
