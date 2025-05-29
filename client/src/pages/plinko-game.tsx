import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from "@tanstack/react-query"
import { useToast } from '@/hooks/use-toast'

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

// Game constants
const MIN_BET = 0.0001 // Minimum bet in ARK
const MAX_BET = 5 // Maximum bet in ARK
const HOUSE_ADDRESS = 'AdEKeaC8sBm24RHwnPvZfEWUiCPB4Z2xZp'

// Plinko game physics constants
const BALL_RADIUS = 10
const PEG_RADIUS = 5
const GRAVITY = 0.3
const BOUNCE_DAMPING = 0.7
const HORIZONTAL_DAMPING = 0.98

// Plinko multipliers (from left to right)
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
    
    const canvasWidth = 1400
    const canvasHeight = 900
    
    const playAreaTop = 100
    const playAreaBottom = canvasHeight - 100
    const playAreaLeft = 70
    const playAreaRight = canvasWidth - 70
    const playAreaWidth = playAreaRight - playAreaLeft
    const playAreaHeight = playAreaBottom - playAreaTop
    
    const numRows = 20
    
    for (let row = 0; row < numRows; row++) {
      const y = playAreaTop + (row * (playAreaHeight / (numRows - 1)))
      const pegsInRow = 6 + Math.floor((row / (numRows - 1)) * 13)
      
      for (let col = 0; col < pegsInRow; col++) {
        let x
        if (pegsInRow === 1) {
          x = canvasWidth / 2
        } else {
          x = playAreaLeft + (col * (playAreaWidth / (pegsInRow - 1)))
        }
        
        if (row % 2 === 1) {
          x += (playAreaWidth / (pegsInRow - 1)) / 2
        }
        
        if (x >= playAreaLeft && x <= playAreaRight) {
          pegs.push({ x, y, radius: PEG_RADIUS })
        }
      }
    }
    
    pegsRef.current = pegs
  }, [])

  // Drop ball when triggered
  useEffect(() => {
    if (triggerDrop) {
      dropBall()
      onTriggerComplete()
    }
  }, [triggerDrop, onTriggerComplete])

  const dropBall = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

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
  }, [])

  const checkCollision = (ball: Ball, peg: Peg): boolean => {
    const dx = ball.x - peg.x
    const dy = ball.y - peg.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < (ball.radius + peg.radius)
  }

  const resolveBallPegCollision = (ball: Ball, peg: Peg) => {
    const dx = ball.x - peg.x
    const dy = ball.y - peg.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance < (ball.radius + peg.radius)) {
      const normalX = dx / distance
      const normalY = dy / distance
      
      ball.x = peg.x + normalX * (ball.radius + peg.radius)
      ball.y = peg.y + normalY * (ball.radius + peg.radius)
      
      const dotProduct = ball.vx * normalX + ball.vy * normalY
      ball.vx = (ball.vx - 2 * dotProduct * normalX) * BOUNCE_DAMPING
      ball.vy = (ball.vy - 2 * dotProduct * normalY) * BOUNCE_DAMPING
      
      ball.vx += (Math.random() - 0.5) * 0.5
    }
  }

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw pegs
    ctx.fillStyle = '#64748b'
    pegsRef.current.forEach(peg => {
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw multiplier boxes at bottom
    const boxWidth = canvas.width / MULTIPLIERS.length
    const boxHeight = 80
    const boxY = canvas.height - boxHeight

    MULTIPLIERS.forEach((multiplier, index) => {
      const x = index * boxWidth
      
      // Color coding based on multiplier value
      if (multiplier >= 5) {
        ctx.fillStyle = '#22c55e' // Green for high multipliers
      } else if (multiplier >= 1.25) {
        ctx.fillStyle = '#3b82f6' // Blue for medium multipliers  
      } else if (multiplier === 0) {
        ctx.fillStyle = '#f59e0b' // Yellow for break-even
      } else {
        ctx.fillStyle = '#ef4444' // Red for losing slots
      }
      
      ctx.fillRect(x, boxY, boxWidth, boxHeight)
      
      // Box border
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 2
      ctx.strokeRect(x, boxY, boxWidth, boxHeight)
      
      // Multiplier text
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      let displayText = ''
      if (multiplier === -1) {
        displayText = 'LOSE'
      } else if (multiplier === -0.5) {
        displayText = '0.5x'
      } else if (multiplier === 0) {
        displayText = 'EVEN'
      } else {
        displayText = `${multiplier}x`
      }
      
      ctx.fillText(displayText, x + boxWidth / 2, boxY + boxHeight / 2)
    })

    // Update and draw balls
    ballsRef.current = ballsRef.current.filter(ball => {
      if (!ball.active) return false

      // Apply physics
      ball.vy += GRAVITY
      ball.vx *= HORIZONTAL_DAMPING
      ball.x += ball.vx
      ball.y += ball.vy

      // Check collision with pegs
      pegsRef.current.forEach(peg => {
        if (checkCollision(ball, peg)) {
          resolveBallPegCollision(ball, peg)
        }
      })

      // Check if ball reached bottom
      if (ball.y > boxY - ball.radius) {
        const slotIndex = Math.floor(ball.x / boxWidth)
        const validSlotIndex = Math.max(0, Math.min(MULTIPLIERS.length - 1, slotIndex))
        const landedMultiplier = MULTIPLIERS[validSlotIndex]
        onBallLanded(landedMultiplier)
        return false
      }

      // Wall bouncing
      if (ball.x <= ball.radius || ball.x >= canvas.width - ball.radius) {
        ball.vx *= -BOUNCE_DAMPING
        ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x))
      }

      // Draw ball
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2
      ctx.stroke()

      return true
    })

    animationRef.current = requestAnimationFrame(animate)
  }, [onBallLanded])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate])

  return (
    <canvas
      ref={canvasRef}
      width={1400}
      height={900}
      className="border-2 border-gray-600 rounded-lg bg-gray-900"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  )
}

// ARK Connect integration
function ArkConnect({ onWalletConnected, onDisconnect, connectedWallet }: {
  onWalletConnected: (wallet: ArkWallet) => void
  onDisconnect: () => void
  connectedWallet?: ArkWallet | null
}) {
  const [isConnecting, setIsConnecting] = useState(false)
  const { toast } = useToast()

  // Check for existing connection on mount
  useEffect(() => {
    checkExistingConnection()
  }, [])

  const checkExistingConnection = async () => {
    if (typeof window !== 'undefined' && window.arkconnect) {
      try {
        const account = await window.arkconnect.getAccount()
        if (account) {
          const balance = await window.arkconnect.getBalance(account.address)
          onWalletConnected({
            address: account.address,
            publicKey: account.publicKey,
            balance: (parseFloat(balance) / 100000000).toString()
          })
        }
      } catch (error) {
        console.log('No existing account found')
      }
    }
  }

  const connectWallet = async () => {
    if (!window.arkconnect) {
      toast({
        title: "ARK Connect Required",
        description: "Please install the ARK Connect browser extension to play ARKlinko.",
        variant: "destructive"
      })
      return
    }

    setIsConnecting(true)
    try {
      const account = await window.arkconnect.connect()
      const balance = await window.arkconnect.getBalance(account.address)
      
      const wallet: ArkWallet = {
        address: account.address,
        publicKey: account.publicKey,
        balance: (parseFloat(balance) / 100000000).toString()
      }
      
      onWalletConnected(wallet)
      toast({
        title: "Wallet Connected",
        description: `Connected to ${account.address.substring(0, 10)}...`,
      })
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect ARK wallet. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    if (window.arkconnect) {
      await window.arkconnect.disconnect()
    }
    onDisconnect()
    toast({
      title: "Wallet Disconnected",
      description: "ARK wallet has been disconnected.",
    })
  }

  if (connectedWallet) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">Connected Wallet</p>
            <p className="font-mono text-sm">{connectedWallet.address.substring(0, 20)}...</p>
            <p className="text-lg font-bold text-green-400">{connectedWallet.balance} ARK</p>
          </div>
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg text-center">
      <h3 className="text-xl font-bold mb-4">Connect ARK Wallet</h3>
      <p className="text-gray-400 mb-4">Connect your ARK wallet to play ARKlinko with real cryptocurrency</p>
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isConnecting ? 'Connecting...' : 'Connect ARK Wallet'}
      </button>
    </div>
  )
}

// Main ARKlinko Game Component
export default function ARKlinko() {
  const [wallet, setWallet] = useState<ArkWallet | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle')
  const [triggerDrop, setTriggerDrop] = useState(false)
  const [gameHistory, setGameHistory] = useState<any[]>([])
  const { toast } = useToast()

  // Fetch real-time balance
  const { data: realTimeBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['arkBalance', wallet?.address],
    queryFn: async () => {
      if (!wallet?.address) return null
      
      const response = await fetch(`https://api.ark.io/api/v2/wallets/${wallet.address}`)
      const data = await response.json()
      
      if (data.data && data.data.balance) {
        return (parseInt(data.data.balance) / 100000000).toString()
      }
      return '0'
    },
    enabled: !!wallet?.address,
    refetchInterval: 10000 // Refresh every 10 seconds
  })

  // Game play mutation
  const playGameMutation = useMutation({
    mutationFn: async ({ betAmount, multiplier }: { betAmount: number, multiplier: number }) => {
      const response = await fetch('/api/game/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betAmount,
          multiplier,
          playerAddress: wallet?.address
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Game failed')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      setGameHistory(prev => [data, ...prev.slice(0, 9)])
      refetchBalance()
      
      if (data.isWin) {
        toast({
          title: "You Won!",
          description: `Won ${data.payout} ARK (${data.multiplier}x)`,
        })
      } else {
        toast({
          title: "Better Luck Next Time",
          description: `Lost ${data.betAmount} ARK`,
          variant: "destructive"
        })
      }
      
      setGameState('idle')
    },
    onError: (error: any) => {
      toast({
        title: "Game Error",
        description: error.message,
        variant: "destructive"
      })
      setGameState('idle')
    }
  })

  const handleWalletConnected = (connectedWallet: ArkWallet) => {
    setWallet(connectedWallet)
  }

  const handleDisconnect = () => {
    setWallet(null)
    setBetAmount('')
    setGameHistory([])
  }

  const handleBallLanded = (multiplier: number) => {
    const bet = parseFloat(betAmount)
    playGameMutation.mutate({ betAmount: bet, multiplier })
  }

  const handleTriggerComplete = () => {
    setTriggerDrop(false)
  }

  const playGame = () => {
    const bet = parseFloat(betAmount)
    const currentBalance = parseFloat(realTimeBalance || wallet?.balance || '0')
    
    if (!bet || bet < MIN_BET || bet > MAX_BET) {
      toast({
        title: "Invalid Bet",
        description: `Bet must be between ${MIN_BET} and ${MAX_BET} ARK`,
        variant: "destructive"
      })
      return
    }
    
    if (bet > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "Not enough ARK in your wallet",
        variant: "destructive"
      })
      return
    }
    
    setGameState('playing')
    setTriggerDrop(true)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* ARK Logo */}
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">A</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold">ARKlinko</h1>
                <p className="text-gray-400">Provably Fair ARK Cryptocurrency Game</p>
              </div>
            </div>
            
            {/* Wallet Connection */}
            <div className="w-80">
              <ArkConnect 
                onWalletConnected={handleWalletConnected}
                onDisconnect={handleDisconnect}
                connectedWallet={wallet}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {wallet ? (
          <div className="space-y-8">
            {/* Game Canvas */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="flex justify-center">
                <PlinkoCanvas
                  onBallLanded={handleBallLanded}
                  triggerDrop={triggerDrop}
                  onTriggerComplete={handleTriggerComplete}
                />
              </div>
            </div>

            {/* Betting Controls */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="flex items-center justify-center space-x-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Bet Amount (ARK)
                  </label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min={MIN_BET}
                    max={MAX_BET}
                    step={MIN_BET}
                    placeholder={`Min: ${MIN_BET}`}
                    className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    disabled={gameState === 'playing'}
                  />
                </div>
                
                <button
                  onClick={playGame}
                  disabled={gameState === 'playing' || !betAmount || playGameMutation.isPending}
                  className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  {gameState === 'playing' ? 'Ball Dropping...' : 'DROP BALL'}
                </button>
                
                <div className="text-center">
                  <p className="text-sm text-gray-400">Your Balance</p>
                  <p className="text-xl font-bold text-green-400">
                    {realTimeBalance || wallet.balance} ARK
                  </p>
                </div>
              </div>
            </div>

            {/* Game History */}
            {gameHistory.length > 0 && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Recent Games</h3>
                <div className="space-y-2">
                  {gameHistory.map((game, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-700 rounded">
                      <span>Bet: {game.betAmount} ARK</span>
                      <span className={game.isWin ? 'text-green-400' : 'text-red-400'}>
                        {game.isWin ? `Won ${game.payout} ARK` : `Lost ${game.betAmount} ARK`}
                      </span>
                      <span>Multiplier: {game.multiplier}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-4xl font-bold mb-4">Welcome to ARKlinko</h2>
            <p className="text-xl text-gray-400 mb-8">
              Connect your ARK wallet to start playing with real cryptocurrency
            </p>
            <div className="max-w-md mx-auto">
              <ArkConnect 
                onWalletConnected={handleWalletConnected}
                onDisconnect={handleDisconnect}
                connectedWallet={wallet}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Global type declaration for ARK Connect
declare global {
  interface Window {
    arkconnect?: {
      connect: () => Promise<{ address: string; publicKey: string }>;
      disconnect: () => Promise<void>;
      getAccount: () => Promise<{ address: string; publicKey: string } | null>;
      getBalance: (address: string) => Promise<string>;
      isConnected: () => boolean;
      request: (method: string, params?: any) => Promise<any>;
    };
  }
}
