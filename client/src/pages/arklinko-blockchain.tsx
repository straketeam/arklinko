import { useState, useRef, useEffect, useCallback } from 'react'

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

// Strategic Plinko multipliers - center is losing slot, sides have highest payouts
const MULTIPLIERS = [5, 4, 3, 2, 1.75, 1.5, 1.25, 1, 0, -1, 0, 1, 1.25, 1.5, 1.75, 2, 3, 4, 5]
const SLOT_TYPES = ['win', 'win', 'win', 'win', 'win', 'win', 'win', 'free', 'free', 'lose', 'free', 'free', 'win', 'win', 'win', 'win', 'win', 'win', 'win']

// Game wallet address
const GAME_WALLET_ADDRESS = "AdEKeaC8sBm24RHwnPvZfEWUiCPB4Z2xZp"

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

const getArkBalance = async (address: string): Promise<string> => {
  try {
    const response = await fetch(`https://wallets.ark.io/api/wallets/${address}`)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    const data = await response.json()
    if (data.data && data.data.balance) {
      const balance = (parseInt(data.data.balance) / 100000000).toString()
      return balance
    }
    return '0'
  } catch (error) {
    console.error('Error fetching balance:', error)
    return '0'
  }
}

const sendWinningTransaction = async (
  toAddress: string,
  amount: number
): Promise<string | null> => {
  try {
    const response = await fetch('/api/send-winnings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientAddress: toAddress,
        amount: amount
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.transactionId
    } else {
      throw new Error('Failed to send winning transaction')
    }
  } catch (error) {
    console.error('Error sending winning transaction:', error)
    return null
  }
}

const sendArkTransaction = async (
  toAddress: string,
  amount: number,
  wallet: ArkWallet
): Promise<string | null> => {
  try {
    if (!window.arkconnect) {
      throw new Error('ARK Connect not available')
    }

    const amountInArktoshi = Math.floor(amount * 100000000)
    
    const transaction = {
      type: 0,
      amount: amountInArktoshi.toString(),
      recipientId: toAddress,
      fee: '600000'
    }

    const result = await window.arkconnect.signTransaction(transaction)
    
    if (result && result.id) {
      return result.id
    } else {
      throw new Error('Transaction signing failed')
    }
  } catch (error) {
    console.error('Error sending ARK transaction:', error)
    return null
  }
}

function PlinkoCanvas({ 
  onBallLanded, 
  triggerDrop, 
  onTriggerComplete 
}: { 
  onBallLanded: (multiplier: number, slotType: string) => void
  triggerDrop: boolean
  onTriggerComplete: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballsRef = useRef<Ball[]>([])
  const pegsRef = useRef<Peg[]>([])
  const animationRef = useRef<number>()
  const ballIdRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pegs: Peg[] = []
    const canvasWidth = 1600
    const canvasHeight = 1000
    const playAreaTop = 120
    const playAreaBottom = canvasHeight - 120
    const playAreaLeft = 80
    const playAreaRight = canvasWidth - 80
    const playAreaWidth = playAreaRight - playAreaLeft
    const playAreaHeight = playAreaBottom - playAreaTop
    const numRows = 24
    
    for (let row = 0; row < numRows; row++) {
      const y = playAreaTop + (row * (playAreaHeight / (numRows - 1)))
      const pegsInRow = 8 + Math.floor((row / (numRows - 1)) * 16)
      
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

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#64748b'
    pegsRef.current.forEach(peg => {
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
      ctx.fill()
    })

    const boxWidth = canvas.width / MULTIPLIERS.length
    const boxHeight = 80
    const boxY = canvas.height - boxHeight

    MULTIPLIERS.forEach((multiplier, index) => {
      const x = index * boxWidth
      const slotType = SLOT_TYPES[index]
      
      // Strategic coloring based on slot type and multiplier
      if (slotType === 'lose') {
        ctx.fillStyle = '#dc2626' // Dark red for losing slot
      } else if (slotType === 'free') {
        ctx.fillStyle = '#374151' // Gray for free/break-even slots
      } else if (multiplier >= 4) {
        ctx.fillStyle = '#059669' // Dark green for highest multipliers
      } else if (multiplier >= 2) {
        ctx.fillStyle = '#16a34a' // Green for good multipliers
      } else {
        ctx.fillStyle = '#22c55e' // Light green for lower multipliers
      }
      
      ctx.fillRect(x, boxY, boxWidth, boxHeight)
      
      // Draw border
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 2
      ctx.strokeRect(x, boxY, boxWidth, boxHeight)
      
      // Draw text/symbols
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 18px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      let displayText = ''
      if (slotType === 'lose') {
        displayText = '☠️'
        ctx.font = 'bold 24px Arial'
      } else if (slotType === 'free') {
        displayText = 'FREE'
        ctx.font = 'bold 12px Arial'
      } else {
        displayText = `${multiplier}x`
      }
      
      ctx.fillText(displayText, x + boxWidth / 2, boxY + boxHeight / 2)
    })

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
        const slotType = SLOT_TYPES[validSlotIndex]
        onBallLanded(landedMultiplier, slotType)
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
      width={1600}
      height={1000}
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

function ArkConnect({ onWalletConnected, onDisconnect, connectedWallet, onBalanceUpdate }: {
  onWalletConnected: (wallet: ArkWallet) => void
  onDisconnect: () => void
  connectedWallet: ArkWallet | null
  onBalanceUpdate: (newBalance: string) => void
}) {
  const [isConnecting, setIsConnecting] = useState(false)

  const connectWallet = async () => {
    if (isConnecting) return
    setIsConnecting(true)

    try {
      if (!window.arkconnect) {
        throw new Error('ARK Connect extension not installed')
      }

      console.log('ARK Connect found, checking for existing connection...')

      // Use the connect method directly
      const connectResult = await window.arkconnect.connect()
      console.log('Connection result:', connectResult)

      let address: string = ''

      // Handle different response formats from ARK Connect
      if (typeof connectResult === 'string') {
        address = connectResult
      } else if (connectResult && typeof connectResult === 'object') {
        // Try multiple possible property names
        address = connectResult.address || 
                 connectResult.account || 
                 connectResult.walletAddress || 
                 connectResult.data?.address || 
                 ''
      }

      // Get address using getAddress method if connect didn't return it
      if (!address) {
        try {
          const addressResult = await window.arkconnect.getAddress()
          address = typeof addressResult === 'string' ? addressResult : 
                   (addressResult?.address || addressResult?.data?.address || '')
        } catch (getAddressError) {
          console.error('Error getting address:', getAddressError)
        }
      }

      // Final validation
      if (!address || typeof address !== 'string' || address.length < 30) {
        console.error('Invalid address received:', address)
        throw new Error('Failed to get valid wallet address from ARK Connect')
      }

      console.log('Connected to address:', address)

      const balance = await getArkBalance(address)
      const wallet: ArkWallet = {
        address,
        balance,
        publicKey: ''
      }

      onWalletConnected(wallet)
      showNotification('Wallet connected successfully!')

    } catch (error: any) {
      console.error('Connection error:', error)
      showNotification(`Connection failed: ${error.message}`, 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      if (window.arkconnect?.disconnect) {
        await window.arkconnect.disconnect()
      }
      onDisconnect()
      showNotification('Wallet disconnected')
    } catch (error) {
      console.error('Disconnect error:', error)
      onDisconnect() // Disconnect locally even if extension fails
    }
  }

  if (connectedWallet) {
    return (
      <div style={{ 
        backgroundColor: '#1f2937', 
        padding: '24px', 
        borderRadius: '12px', 
        marginBottom: '32px',
        border: '1px solid #374151'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              Wallet Connected
            </div>
            <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>
              Address: {typeof connectedWallet.address === 'string' ? 
                connectedWallet.address.slice(0, 10) + '...' + connectedWallet.address.slice(-6) : 
                'Invalid Address'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22c55e' }}>
              Balance: {parseFloat(connectedWallet.balance).toFixed(4)} ARK
            </div>
          </div>
          <button
            onClick={disconnect}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      backgroundColor: '#1f2937', 
      padding: '32px', 
      borderRadius: '12px', 
      textAlign: 'center', 
      marginBottom: '32px',
      border: '1px solid #374151'
    }}>
      <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Connect Your ARK Wallet</h2>
      <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
        Connect your ARK wallet to play with real ARK cryptocurrency
      </p>
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        style={{
          backgroundColor: isConnecting ? '#6b7280' : '#3b82f6',
          color: 'white',
          border: 'none',
          padding: '16px 32px',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: isConnecting ? 'not-allowed' : 'pointer'
        }}
      >
        {isConnecting ? 'Connecting...' : 'Connect ARK Wallet'}
      </button>
    </div>
  )
}

export default function ARKlinkoBlockchain() {
  const [wallet, setWallet] = useState<ArkWallet | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle')
  const [gameHistory, setGameHistory] = useState<GameResult[]>([])
  const [triggerDrop, setTriggerDrop] = useState(false)

  const handleWalletConnected = (connectedWallet: ArkWallet) => {
    setWallet(connectedWallet)
  }

  const handleBalanceUpdate = (newBalance: string) => {
    if (wallet) {
      setWallet({ ...wallet, balance: newBalance })
    }
  }

  const handleDisconnect = () => {
    setWallet(null)
    setBetAmount('')
    setGameHistory([])
  }

  const handleBallLanded = async (multiplier: number, slotType: string) => {
    const bet = parseFloat(betAmount)
    let transactionId: string | null = null
    
    try {
      let payout = 0
      let isWin = false

      if (slotType === 'lose') {
        // Total loss - player sends bet to game wallet
        payout = 0
        isWin = false
        
        if (wallet) {
          showNotification(`Processing transaction...`)
          transactionId = await sendArkTransaction(GAME_WALLET_ADDRESS, bet, wallet)
          if (transactionId) {
            showNotification(`Total loss! ${bet} ARK sent to game wallet`, 'error')
          }
        }
      } else if (slotType === 'free') {
        // Break even - no transaction needed
        payout = bet
        isWin = true
        showNotification(`Break even! You keep your ${bet} ARK`)
      } else if (multiplier > 0) {
        // Win - game wallet sends winnings to player
        payout = bet * multiplier
        isWin = true
        
        if (wallet) {
          showNotification(`Processing winning transaction...`)
          transactionId = await sendWinningTransaction(wallet.address, payout)
          if (transactionId) {
            showNotification(`You won ${payout.toFixed(4)} ARK! (${multiplier}x)`)
          } else {
            showNotification(`Win calculated but transaction failed`, 'error')
          }
        }
      }

      const gameResult: GameResult = {
        betAmount: bet,
        multiplier,
        payout,
        isWin,
        transactionId: transactionId || undefined,
        timestamp: Date.now()
      }
      
      setGameHistory(prev => [gameResult, ...prev.slice(0, 9)])
      
      setTimeout(async () => {
        if (wallet) {
          const newBalance = await getArkBalance(wallet.address)
          handleBalanceUpdate(newBalance)
        }
      }, 3000)
      
    } catch (error: any) {
      showNotification(`Game Error: ${error.message}`, 'error')
    }
    
    setGameState('idle')
  }

  const handleTriggerComplete = () => {
    setTriggerDrop(false)
  }

  const playGame = () => {
    if (!wallet) {
      showNotification('Please connect your ARK wallet first', 'error')
      return
    }
    
    const bet = parseFloat(betAmount)
    const balance = parseFloat(wallet.balance)
    
    if (!bet || bet < MIN_BET || bet > MAX_BET) {
      showNotification(`Bet must be between ${MIN_BET} and ${MAX_BET} ARK`, 'error')
      return
    }
    
    if (balance < bet) {
      showNotification('Insufficient ARK balance', 'error')
      return
    }
    
    setGameState('playing')
    setTriggerDrop(true)
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#111827', 
      color: 'white', 
      padding: '24px' 
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '8px' }}>
            ARKlinko
          </h1>
          <p style={{ fontSize: '20px', color: '#9ca3af' }}>
            Real ARK Blockchain Plinko Game
          </p>
        </div>

        <ArkConnect 
          onWalletConnected={handleWalletConnected}
          onDisconnect={handleDisconnect}
          connectedWallet={wallet}
          onBalanceUpdate={handleBalanceUpdate}
        />

        {wallet ? (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
            <div>
              <PlinkoCanvas 
                onBallLanded={handleBallLanded}
                triggerDrop={triggerDrop}
                onTriggerComplete={handleTriggerComplete}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ 
                backgroundColor: '#1f2937', 
                padding: '24px', 
                borderRadius: '12px',
                border: '1px solid #374151'
              }}>
                <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>Place Your Bet</h3>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#9ca3af' }}>
                    Bet Amount (ARK)
                  </label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder={`${MIN_BET} - ${MAX_BET}`}
                    min={MIN_BET}
                    max={MAX_BET}
                    step="0.0001"
                    disabled={gameState === 'playing'}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      backgroundColor: '#111827',
                      color: 'white',
                      fontSize: '16px'
                    }}
                  />
                </div>

                <button
                  onClick={playGame}
                  disabled={gameState === 'playing' || !betAmount}
                  style={{
                    width: '100%',
                    backgroundColor: gameState === 'playing' ? '#6b7280' : '#22c55e',
                    color: 'white',
                    border: 'none',
                    padding: '16px',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: gameState === 'playing' ? 'not-allowed' : 'pointer'
                  }}
                >
                  {gameState === 'playing' ? 'Ball Dropping...' : 'Drop Ball'}
                </button>
              </div>

              {gameHistory.length > 0 && (
                <div style={{ 
                  backgroundColor: '#1f2937', 
                  padding: '24px', 
                  borderRadius: '12px',
                  border: '1px solid #374151'
                }}>
                  <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>Game History</h3>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {gameHistory.map((game, index) => (
                      <div 
                        key={index}
                        style={{ 
                          padding: '12px',
                          marginBottom: '8px',
                          backgroundColor: '#111827',
                          borderRadius: '8px',
                          border: `1px solid ${game.isWin ? '#22c55e' : '#ef4444'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', color: game.isWin ? '#22c55e' : '#ef4444' }}>
                              {game.isWin ? '+' : '-'}{game.payout.toFixed(4)} ARK
                            </div>
                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                              Bet: {game.betAmount} ARK • {game.multiplier}x
                            </div>
                          </div>
                        </div>
                        {game.transactionId && (
                          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                            TX: {game.transactionId.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
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
      request: (method: string, params?: any) => Promise<any>;
      version: () => string;
    };
  }
}
