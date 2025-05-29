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

// Game constants
const MIN_BET = 0.0001
const MAX_BET = 5

// Physics constants
const BALL_RADIUS = 10
const PEG_RADIUS = 5
const GRAVITY = 0.3
const BOUNCE_DAMPING = 0.7
const HORIZONTAL_DAMPING = 0.98

// Plinko multipliers
const MULTIPLIERS = [10, 5, 4, 3, 2, -0.5, 1.5, 1.25, 0, -1, 0, 1.25, 1.5, -0.5, 2, 3, 4, 5, 10]

// Simple notification function
function showNotification(message: string, type: 'success' | 'error' = 'success') {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 1000;
    background-color: ${type === 'success' ? '#22c55e' : '#ef4444'};
  `
  notification.textContent = message
  document.body.appendChild(notification)
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification)
    }
  }, 3000)
}

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

    // Draw multiplier boxes
    const boxWidth = canvas.width / MULTIPLIERS.length
    const boxHeight = 80
    const boxY = canvas.height - boxHeight

    MULTIPLIERS.forEach((multiplier, index) => {
      const x = index * boxWidth
      
      if (multiplier >= 5) {
        ctx.fillStyle = '#22c55e'
      } else if (multiplier >= 1.25) {
        ctx.fillStyle = '#3b82f6'
      } else if (multiplier === 0) {
        ctx.fillStyle = '#f59e0b'
      } else {
        ctx.fillStyle = '#ef4444'
      }
      
      ctx.fillRect(x, boxY, boxWidth, boxHeight)
      
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 2
      ctx.strokeRect(x, boxY, boxWidth, boxHeight)
      
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

      ball.vy += GRAVITY
      ball.vx *= HORIZONTAL_DAMPING
      ball.x += ball.vx
      ball.y += ball.vy

      pegsRef.current.forEach(peg => {
        if (checkCollision(ball, peg)) {
          resolveBallPegCollision(ball, peg)
        }
      })

      if (ball.y > boxY - ball.radius) {
        const slotIndex = Math.floor(ball.x / boxWidth)
        const validSlotIndex = Math.max(0, Math.min(MULTIPLIERS.length - 1, slotIndex))
        const landedMultiplier = MULTIPLIERS[validSlotIndex]
        onBallLanded(landedMultiplier)
        return false
      }

      if (ball.x <= ball.radius || ball.x >= canvas.width - ball.radius) {
        ball.vx *= -BOUNCE_DAMPING
        ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x))
      }

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
      style={{ 
        border: '2px solid #4b5563', 
        borderRadius: '8px', 
        backgroundColor: '#111827',
        maxWidth: '100%', 
        height: 'auto' 
      }}
    />
  )
}

// ARK Connect with domain reset functionality
function ArkConnect({ onWalletConnected, onDisconnect, connectedWallet }: {
  onWalletConnected: (wallet: ArkWallet) => void
  onDisconnect: () => void
  connectedWallet?: ArkWallet | null
}) {
  const [isConnecting, setIsConnecting] = useState(false)

  const checkExistingConnection = async () => {
    if (typeof window !== 'undefined' && window.arkconnect) {
      try {
        console.log('Checking for existing ARK Connect connection...')
        const account = await window.arkconnect.getAccount()
        
        if (account && account.address) {
          console.log('Found existing connection:', account.address)
          const balance = await window.arkconnect.getBalance(account.address)
          onWalletConnected({
            address: account.address,
            publicKey: account.publicKey || '',
            balance: (parseFloat(balance) / 100000000).toString()
          })
        } else {
          console.log('No existing connection found')
        }
      } catch (error) {
        console.log('Connection check failed:', error)
      }
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      checkExistingConnection()
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  const resetAndConnect = async () => {
    console.log('Resetting domain connection and connecting...')
    setIsConnecting(true)
    
    try {
      // First try to disconnect to clear any existing connection
      if (window.arkconnect && window.arkconnect.disconnect) {
        try {
          await window.arkconnect.disconnect()
          console.log('Disconnected existing connection')
          // Wait a moment for the disconnect to process
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (disconnectError) {
          console.log('Disconnect not needed or failed:', disconnectError)
        }
      }
      
      // Now try to connect fresh
      console.log('Attempting fresh connection...')
      const account = await window.arkconnect.connect()
      console.log('Connect successful:', account)
      
      if (!account || !account.address) {
        throw new Error('No account returned from ARK Connect')
      }
      
      console.log('Getting balance for:', account.address)
      const balance = await window.arkconnect.getBalance(account.address)
      console.log('Balance received:', balance)
      
      const wallet: ArkWallet = {
        address: account.address,
        publicKey: account.publicKey || '',
        balance: (parseFloat(balance) / 100000000).toString()
      }
      
      onWalletConnected(wallet)
      showNotification(`Connected to ${account.address.substring(0, 10)}...`)
    } catch (error: any) {
      console.error('ARK Connect error:', error)
      showNotification(`Connection failed: ${error.message || 'Unknown error'}. Try refreshing the page.`, 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      if (window.arkconnect && window.arkconnect.disconnect) {
        await window.arkconnect.disconnect()
      }
    } catch (error) {
      console.error('Disconnect error:', error)
    }
    
    onDisconnect()
    showNotification('ARK wallet has been disconnected.')
  }

  if (connectedWallet) {
    return (
      <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 4px 0' }}>Connected Wallet</p>
            <p style={{ fontFamily: 'monospace', fontSize: '14px', margin: '0 0 4px 0', color: 'white' }}>
              {connectedWallet.address.substring(0, 20)}...
            </p>
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#22c55e', margin: '0' }}>
              {connectedWallet.balance} ARK
            </p>
          </div>
          <button
            onClick={disconnect}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#dc2626', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px', textAlign: 'center' }}>
      <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: 'white' }}>
        Connect ARK Wallet
      </h3>
      <p style={{ color: '#9ca3af', marginBottom: '16px' }}>
        Connect your ARK wallet to play ARKlinko with real cryptocurrency
      </p>
      <button
        onClick={resetAndConnect}
        disabled={isConnecting}
        style={{ 
          padding: '12px 24px', 
          backgroundColor: '#2563eb', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px',
          cursor: isConnecting ? 'not-allowed' : 'pointer',
          opacity: isConnecting ? 0.5 : 1
        }}
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
  const [realTimeBalance, setRealTimeBalance] = useState<string>('')

  // Fetch real-time balance
  useEffect(() => {
    if (!wallet?.address) return

    const fetchBalance = async () => {
      try {
        const response = await fetch(`https://api.ark.io/api/v2/wallets/${wallet.address}`)
        const data = await response.json()
        
        if (data.data && data.data.balance) {
          setRealTimeBalance((parseInt(data.data.balance) / 100000000).toString())
        }
      } catch (error) {
        console.error('Error fetching balance:', error)
      }
    }

    fetchBalance()
    const interval = setInterval(fetchBalance, 10000)
    
    return () => clearInterval(interval)
  }, [wallet?.address])

  const handleWalletConnected = (connectedWallet: ArkWallet) => {
    console.log('Wallet connected:', connectedWallet.address)
    setWallet(connectedWallet)
  }

  const handleDisconnect = () => {
    console.log('Wallet disconnected')
    setWallet(null)
    setBetAmount('')
    setGameHistory([])
    setRealTimeBalance('')
  }

  const handleBallLanded = async (multiplier: number) => {
    const bet = parseFloat(betAmount)

    try {
      const response = await fetch('/api/game/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betAmount: bet,
          multiplier,
          playerAddress: wallet?.address
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Game failed')
      }
      
      const data = await response.json()
      setGameHistory(prev => [data, ...prev.slice(0, 9)])
      
      if (data.isWin) {
        showNotification(`You Won! ${data.payout} ARK (${data.multiplier}x)`)
      } else {
        showNotification(`Lost ${data.betAmount} ARK`, 'error')
      }
    } catch (error: any) {
      showNotification(`Game Error: ${error.message}`, 'error')
    }
    
    setGameState('idle')
  }

  const handleTriggerComplete = () => {
    setTriggerDrop(false)
  }

  const playGame = () => {
    const bet = parseFloat(betAmount)
    const currentBalance = parseFloat(realTimeBalance || wallet?.balance || '0')
    
    if (!bet || bet < MIN_BET || bet > MAX_BET) {
      showNotification(`Bet must be between ${MIN_BET} and ${MAX_BET} ARK`, 'error')
      return
    }
    
    if (bet > currentBalance) {
      showNotification('Not enough ARK in your wallet', 'error')
      return
    }
    
    setGameState('playing')
    setTriggerDrop(true)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111827', color: 'white' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1f2937', borderBottom: '1px solid #374151' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                backgroundColor: '#dc2626', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>A</span>
              </div>
              <div>
                <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: '0' }}>ARKlinko</h1>
                <p style={{ color: '#9ca3af', margin: '0' }}>Provably Fair ARK Cryptocurrency Game</p>
              </div>
            </div>
            
            <div style={{ width: '320px' }}>
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
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 16px' }}>
        {wallet ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Game Canvas */}
            <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PlinkoCanvas
                  onBallLanded={handleBallLanded}
                  triggerDrop={triggerDrop}
                  onTriggerComplete={handleTriggerComplete}
                />
              </div>
            </div>

            {/* Betting Controls */}
            <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>
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
                    disabled={gameState === 'playing'}
                    style={{ 
                      width: '128px', 
                      padding: '8px 12px', 
                      backgroundColor: '#374151', 
                      border: '1px solid #4b5563', 
                      borderRadius: '4px', 
                      color: 'white' 
                    }}
                  />
                </div>
                
                <button
                  onClick={playGame}
                  disabled={gameState === 'playing' || !betAmount}
                  style={{ 
                    padding: '12px 32px', 
                    backgroundColor: '#dc2626', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 'bold',
                    cursor: (gameState === 'playing' || !betAmount) ? 'not-allowed' : 'pointer',
                    opacity: (gameState === 'playing' || !betAmount) ? 0.5 : 1
                  }}
                >
                  {gameState === 'playing' ? 'Ball Dropping...' : 'DROP BALL'}
                </button>
                
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 4px 0' }}>Your Balance</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e', margin: '0' }}>
                    {realTimeBalance || wallet.balance} ARK
                  </p>
                </div>
              </div>
            </div>

            {/* Game History */}
            {gameHistory.length > 0 && (
              <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Recent Games</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {gameHistory.map((game, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px', 
                      backgroundColor: '#374151', 
                      borderRadius: '4px' 
                    }}>
                      <span>Bet: {game.betAmount} ARK</span>
                      <span style={{ color: game.isWin ? '#22c55e' : '#ef4444' }}>
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
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px' }}>Welcome to ARKlinko</h2>
            <p style={{ fontSize: '20px', color: '#9ca3af', marginBottom: '32px' }}>
              Connect your ARK wallet to start playing with real cryptocurrency
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

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
