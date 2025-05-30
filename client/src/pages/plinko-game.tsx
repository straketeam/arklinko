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

// Plinko multipliers with proper -0.5x handling
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
        displayText = '☠'
      } else if (multiplier === -0.5) {
        displayText = '-0.5x'
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

// ARK Connect with proper API implementation
function ArkConnect({ onWalletConnected, onDisconnect, connectedWallet, onBalanceUpdate }: {
  onWalletConnected: (wallet: ArkWallet) => void
  onDisconnect: () => void
  connectedWallet?: ArkWallet | null
  onBalanceUpdate?: (balance: string) => void
}) {
  const [isConnecting, setIsConnecting] = useState(false)

  // Fetch real-time balance from ARK API
  const fetchRealTimeBalance = useCallback(async (address: string) => {
    try {
      const response = await fetch(`https://api.ark.io/api/v2/wallets/${address}`)
      const data = await response.json()
      
      if (data.data && data.data.balance) {
        const balance = (parseInt(data.data.balance) / 100000000).toString()
        if (onBalanceUpdate) {
          onBalanceUpdate(balance)
        }
        return balance
      }
    } catch (error) {
      console.error('Error fetching real-time balance:', error)
    }
    return null
  }, [onBalanceUpdate])

  // Auto-update balance every 5 seconds when connected
  useEffect(() => {
    if (!connectedWallet?.address) return

    const interval = setInterval(() => {
      fetchRealTimeBalance(connectedWallet.address)
    }, 5000)
    
    return () => clearInterval(interval)
  }, [connectedWallet?.address, fetchRealTimeBalance])

  const connectWallet = async () => {
    if (!window.arkconnect) {
      showNotification('Please install the ARK Connect browser extension.', 'error')
      return
    }

    setIsConnecting(true)
    
    try {
      console.log('Attempting ARK Connect...')
      
      // Check if already connected first
      try {
        const isConnected = await window.arkconnect.isConnected()
        console.log('Is already connected:', isConnected)
        
        if (isConnected) {
          console.log('Already connected, getting wallet info...')
          const address = await window.arkconnect.getAddress()
          const balance = await window.arkconnect.getBalance()
          const arkBalance = (parseFloat(balance) / 100000000).toString()
          
          const wallet: ArkWallet = {
            address: address,
            publicKey: '',
            balance: arkBalance
          }
          
          onWalletConnected(wallet)
          showNotification(`Connected to ${address.substring(0, 10)}...`)
          return
        }
      } catch (checkError) {
        console.log('Error checking existing connection:', checkError)
      }
      
      // Attempt new connection
      const result = await window.arkconnect.connect()
      console.log('ARK Connect result:', result)
      console.log('Result type:', typeof result)
      console.log('Result properties:', result ? Object.keys(result) : 'null')
      
      // Check if connection was successful
      if (result && typeof result === 'object' && result.status === 'success') {
        console.log('Connection successful, now getting account data...')
        
        // Use the correct ARK Connect API methods
        try {
          console.log('Getting address using getAddress()...')
          const address = await window.arkconnect.getAddress()
          console.log('Address from getAddress():', address)
          
          if (address) {
            console.log('Getting balance using getBalance()...')
            const balance = await window.arkconnect.getBalance()
            console.log('Balance from getBalance():', balance)
            
            // Convert balance from arktoshi to ARK (divide by 100,000,000)
            const arkBalance = (parseFloat(balance) / 100000000).toString()
            
            const wallet: ArkWallet = {
              address: address,
              publicKey: '',
              balance: arkBalance
            }
            
            onWalletConnected(wallet)
            showNotification(`Connected to ${address.substring(0, 10)}...`)
            return
          }
          
          throw new Error('Could not retrieve wallet address after successful connection')
        } catch (accountError) {
          console.error('Failed to get account after successful connection:', accountError)
          throw new Error('Connected successfully but could not retrieve wallet data')
        }
      }
      
      // Handle error responses
      if (result && typeof result === 'object' && result.status === 'failed') {
        if (result.message?.includes('already connected')) {
          showNotification('Domain already connected. Please refresh the page and try again.', 'error')
          return
        }
        throw new Error(result.message || 'ARK Connect failed')
      }
      
      // Handle direct address return (fallback)
      let address = ''
      
      if (typeof result === 'string') {
        address = result
      } else if (result && typeof result === 'object') {
        address = result.address || result.walletAddress || result.account || result.wallet || ''
      }
      
      if (!address) {
        const resultInfo = result ? JSON.stringify(result) : 'null'
        throw new Error(`No wallet address found in ARK Connect response: ${resultInfo}`)
      }
      
      // Get balance and create wallet object
      const balance = await window.arkconnect.getBalance()
      const arkBalance = (parseFloat(balance) / 100000000).toString()
      
      const wallet: ArkWallet = {
        address: address,
        publicKey: '',
        balance: arkBalance
      }
      
      onWalletConnected(wallet)
      showNotification(`Connected to ${address.substring(0, 10)}...`)
      
    } catch (error: any) {
      console.error('ARK Connect error:', error)
      if (error.message?.includes('already connected')) {
        showNotification('Wallet already connected. Please refresh page first.', 'error')
      } else {
        showNotification(`Connection failed: ${error.message}`, 'error')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      if (window.arkconnect?.disconnect) {
        await window.arkconnect.disconnect()
      }
    } catch (error) {
      console.error('Disconnect error:', error)
    }
    
    onDisconnect()
    showNotification('ARK wallet disconnected.')
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
        Connect your ARK wallet to play ARKlinko
      </p>
      <button
        onClick={connectWallet}
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
  const [currentBalance, setCurrentBalance] = useState<string>('')

  const handleWalletConnected = (connectedWallet: ArkWallet) => {
    console.log('Wallet connected:', connectedWallet.address)
    setWallet(connectedWallet)
    setCurrentBalance(connectedWallet.balance)
  }

  const handleBalanceUpdate = (newBalance: string) => {
    setCurrentBalance(newBalance)
    if (wallet) {
      setWallet(prev => prev ? { ...prev, balance: newBalance } : null)
    }
  }

  const handleDisconnect = () => {
    console.log('Wallet disconnected')
    setWallet(null)
    setBetAmount('')
    setGameHistory([])
    setCurrentBalance('')
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
      
      // Update balance based on game result
      if (multiplier === -1) {
        showNotification(`Ball hit skull! Lost ${bet} ARK`, 'error')
      } else if (multiplier === -0.5) {
        showNotification(`Half-loss! Lost ${(bet * 0.5).toFixed(4)} ARK`, 'error')
      } else if (multiplier === 0) {
        showNotification(`Break even! Got ${bet} ARK back`)
      } else if (multiplier >= 1.25) {
        showNotification(`You Won! ${(bet * multiplier).toFixed(4)} ARK (${multiplier}x)`)
      } else {
        showNotification(`Small win: ${(bet * multiplier).toFixed(4)} ARK (${multiplier}x)`)
      }
      
      // Force balance refresh after game
      if (wallet?.address) {
        setTimeout(async () => {
          try {
            const response = await fetch(`https://api.ark.io/api/v2/wallets/${wallet.address}`)
            const data = await response.json()
            if (data.data?.balance) {
              const newBalance = (parseInt(data.data.balance) / 100000000).toString()
              handleBalanceUpdate(newBalance)
            }
          } catch (error) {
            console.error('Error refreshing balance:', error)
          }
        }, 1000)
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
    const balance = parseFloat(currentBalance || wallet?.balance || '0')
    
    if (!bet || bet < MIN_BET || bet > MAX_BET) {
      showNotification(`Bet must be between ${MIN_BET} and ${MAX_BET} ARK`, 'error')
      return
    }
    
    if (bet > balance) {
      showNotification('Not enough ARK in your wallet', 'error')
      return
    }
    
    setGameState('playing')
    setTriggerDrop(true)
  }

  const displayBalance = currentBalance || wallet?.balance || '0'

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
                onBalanceUpdate={handleBalanceUpdate}
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
                  <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 4px 0' }}>Live Balance</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e', margin: '0' }}>
                    {displayBalance} ARK
                  </p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>Updates every 5s</p>
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ 
            backgroundColor: '#1f2937', 
            padding: '48px', 
            borderRadius: '8px', 
            textAlign: 'center' 
          }}>
            <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
              Welcome to ARKlinko!
            </h2>
            <p style={{ fontSize: '18px', color: '#9ca3af', marginBottom: '32px' }}>
              Connect your ARK wallet to start playing the most exciting blockchain Plinko game.
            </p>
            <p style={{ color: '#6b7280' }}>
              Minimum bet: {MIN_BET} ARK • Maximum bet: {MAX_BET} ARK
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
      connect: () => Promise<any>;
      disconnect: () => Promise<void>;
      getAddress: () => Promise<string>;
      getBalance: () => Promise<string>;
      isConnected: () => Promise<boolean>;
      getNetwork: () => Promise<string>;
      signTransaction: (request: any) => Promise<any>;
      signMessage: (request: any) => Promise<any>;
      version: () => string;
    };
  }
}
