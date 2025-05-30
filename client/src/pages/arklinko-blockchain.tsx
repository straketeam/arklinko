import { useState, useRef, useEffect, useCallback } from 'react'

// ARK blockchain constants
const ARK_TRANSACTION_FEE = 0.006 // ARK network fee
const LOSS_ADDRESS = 'AdEKeaC8sBm24RHwnPvZfEWUiCPB4Z2xZp' // Address to send losses

// Game constants
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const BALL_RADIUS = 8
const PEG_RADIUS = 6
const GRAVITY = 0.3
const BOUNCE_DAMPING = 0.7
const FRICTION = 0.99

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

// Notification system
function showNotification(message: string, type: 'success' | 'error' = 'success') {
  const notification = document.createElement('div')
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
    ${type === 'success' 
      ? 'background-color: #10b981; border: 1px solid #059669;' 
      : 'background-color: #ef4444; border: 1px solid #dc2626;'
    }
  `
  notification.textContent = message
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification)
    }
  }, 5000)
}

// ARK transaction function
const sendLossTransaction = async (
  toAddress: string, 
  amount: number, 
  wallet: ArkWallet
): Promise<string | null> => {
  try {
    if (!window.arkconnect) {
      throw new Error('ARK Connect not available')
    }

    const balance = parseFloat(wallet.balance)
    const totalRequired = amount + ARK_TRANSACTION_FEE
    
    if (balance < totalRequired) {
      throw new Error('Insufficient ARK balance for transaction + fees')
    }

    const amountInArktoshi = Math.floor(amount * 100000000)
    
    console.log('Sending real ARK transaction:', { toAddress, amount, amountInArktoshi })

    const txData = {
      type: 0,
      typeGroup: 1,
      amount: amountInArktoshi,
      fee: Math.floor(ARK_TRANSACTION_FEE * 100000000),
      recipientId: toAddress,
      vendorField: `ARKlinko ${amount} ARK`
    }
    
    console.log('ARK Connect transaction data:', txData)

    const result = await window.arkconnect.signTransaction(txData)
    console.log('ARK Connect result:', result)
    
    if (result && result.status === 'success') {
      const txId = result.data?.id || result.data?.transactionId || result.transactionId
      if (txId) {
        showNotification(`Transaction sent! TX: ${txId.substring(0, 10)}...`)
        return txId
      }
    }
    
    if (result && result.status === 'failed') {
      throw new Error(result.message || 'Transaction failed')
    }
    
    throw new Error('Transaction failed - no transaction ID returned')
    
  } catch (error: any) {
    console.error('ARK transaction error:', error)
    
    if (error.message && error.message.includes('rejected')) {
      showNotification('Transaction cancelled by user', 'error')
    } else if (error.message && error.message.includes('insufficient')) {
      showNotification('Insufficient ARK balance', 'error')
    } else {
      showNotification(`Transaction error: ${error.message}`, 'error')
    }
    
    return null
  }
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
  const animationRef = useRef<number>()
  const ballsRef = useRef<Ball[]>([])
  const pegsRef = useRef<Peg[]>([])
  const nextBallIdRef = useRef(1)

  const multipliers = [0.2, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0, 5.0, 3.0, 2.0, 1.5, 1.0, 0.5, 0.2]

  useEffect(() => {
    const pegs: Peg[] = []
    const rows = 12
    const startY = 100
    const rowSpacing = 35
    
    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 3
      const rowWidth = pegsInRow * 50
      const startX = (CANVAS_WIDTH - rowWidth) / 2 + 25
      
      for (let i = 0; i < pegsInRow; i++) {
        pegs.push({
          x: startX + i * 50,
          y: startY + row * rowSpacing,
          radius: PEG_RADIUS
        })
      }
    }
    
    pegsRef.current = pegs
  }, [])

  const dropBall = useCallback(() => {
    const newBall: Ball = {
      x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 20,
      y: 50,
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      radius: BALL_RADIUS,
      active: true,
      id: nextBallIdRef.current++
    }
    
    ballsRef.current.push(newBall)
  }, [])

  useEffect(() => {
    if (triggerDrop) {
      dropBall()
      onTriggerComplete()
    }
  }, [triggerDrop, dropBall, onTriggerComplete])

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
      const angle = Math.atan2(dy, dx)
      const targetX = peg.x + Math.cos(angle) * (ball.radius + peg.radius)
      const targetY = peg.y + Math.sin(angle) * (ball.radius + peg.radius)
      
      ball.x = targetX
      ball.y = targetY
      
      const normalX = dx / distance
      const normalY = dy / distance
      
      const relativeVelocityX = ball.vx
      const relativeVelocityY = ball.vy
      
      const speed = relativeVelocityX * normalX + relativeVelocityY * normalY
      
      if (speed < 0) return
      
      ball.vx -= speed * normalX * BOUNCE_DAMPING
      ball.vy -= speed * normalY * BOUNCE_DAMPING
      
      ball.vx += (Math.random() - 0.5) * 1
    }
  }

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.fillStyle = '#8B5CF6'
    pegsRef.current.forEach(peg => {
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
      ctx.fill()
    })

    const boxWidth = CANVAS_WIDTH / multipliers.length
    const boxHeight = 40
    const boxY = CANVAS_HEIGHT - boxHeight

    multipliers.forEach((multiplier, index) => {
      const x = index * boxWidth
      
      if (multiplier >= 5) {
        ctx.fillStyle = '#10B981'
      } else if (multiplier >= 2) {
        ctx.fillStyle = '#3B82F6'
      } else if (multiplier >= 1) {
        ctx.fillStyle = '#6B7280'
      } else {
        ctx.fillStyle = '#EF4444'
      }
      
      ctx.fillRect(x, boxY, boxWidth, boxHeight)
      
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 2
      ctx.strokeRect(x, boxY, boxWidth, boxHeight)
      
      ctx.fillStyle = 'white'
      ctx.font = '14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${multiplier}x`, x + boxWidth/2, boxY + 25)
    })

    ballsRef.current = ballsRef.current.filter(ball => {
      if (!ball.active) return false

      ball.vy += GRAVITY
      ball.vx *= FRICTION
      ball.vy *= FRICTION

      ball.x += ball.vx
      ball.y += ball.vy

      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius
        ball.vx = Math.abs(ball.vx) * BOUNCE_DAMPING
      }
      if (ball.x + ball.radius > CANVAS_WIDTH) {
        ball.x = CANVAS_WIDTH - ball.radius
        ball.vx = -Math.abs(ball.vx) * BOUNCE_DAMPING
      }

      pegsRef.current.forEach(peg => {
        if (checkCollision(ball, peg)) {
          resolveBallPegCollision(ball, peg)
        }
      })

      if (ball.y > boxY - ball.radius) {
        const boxIndex = Math.floor(ball.x / boxWidth)
        const clampedIndex = Math.max(0, Math.min(multipliers.length - 1, boxIndex))
        const multiplier = multipliers[clampedIndex]
        
        onBallLanded(multiplier)
        ball.active = false
        return false
      }

      ctx.fillStyle = '#F59E0B'
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#D97706'
      ctx.lineWidth = 2
      ctx.stroke()

      return true
    })

    animationRef.current = requestAnimationFrame(animate)
  }, [multipliers, onBallLanded])

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
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="border border-gray-300 rounded-lg bg-gradient-to-b from-purple-900 to-purple-700"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  )
}

function ArkConnect({ onWalletConnected, onDisconnect, connectedWallet, onBalanceUpdate }: {
  onWalletConnected: (wallet: ArkWallet) => void
  onDisconnect: () => void
  connectedWallet: ArkWallet | null
  onBalanceUpdate: (balance: string) => void
}) {
  const [connecting, setConnecting] = useState(false)

  const connectWallet = async () => {
    try {
      setConnecting(true)
      
      if (!window.arkconnect) {
        showNotification('ARK Connect extension not found. Please install it first.', 'error')
        return
      }

      console.log('ARK Connect found, checking for existing connection...')
      
      const isConnected = await window.arkconnect.isConnected()
      
      if (!isConnected) {
        console.log('No existing account found, requesting connection...')
        await window.arkconnect.connect()
      }

      const address = await window.arkconnect.getAddress()
      const balance = await window.arkconnect.getBalance()
      
      console.log('Connected to ARK wallet:', { address, balance })

      const wallet: ArkWallet = {
        address: address,
        balance: balance,
        publicKey: ''
      }

      onWalletConnected(wallet)
      showNotification(`Connected to ARK wallet: ${address.substring(0, 10)}...`)
      
    } catch (error: any) {
      console.error('ARK Connect error:', error)
      showNotification(`Connection failed: ${error.message || 'Unknown error'}`, 'error')
    } finally {
      setConnecting(false)
    }
  }

  const refreshBalance = async () => {
    if (!connectedWallet || !window.arkconnect) return
    
    try {
      const balance = await window.arkconnect.getBalance()
      onBalanceUpdate(balance)
    } catch (error) {
      console.error('Failed to refresh balance:', error)
    }
  }

  return (
    <div className="mb-6 bg-white rounded-lg shadow-md">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-blue-600">💰</span>
          ARK Wallet Connection
        </h3>
      </div>
      <div className="p-4">
        {connectedWallet ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Address:</p>
                <p className="font-mono text-sm">{connectedWallet.address}</p>
              </div>
              <button 
                onClick={refreshBalance}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm border"
              >
                Refresh
              </button>
            </div>
            
            <div>
              <p className="text-sm text-gray-600">Balance:</p>
              <p className="font-mono text-lg font-bold">{connectedWallet.balance} ARK</p>
            </div>
            
            <button 
              onClick={onDisconnect}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded border"
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-gray-600">Connect your ARK wallet to start playing</p>
            <button 
              onClick={connectWallet} 
              disabled={connecting}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded"
            >
              {connecting ? 'Connecting...' : 'Connect ARK Wallet'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ARKlinkoSimple() {
  const [connectedWallet, setConnectedWallet] = useState<ArkWallet | null>(null)
  const [betAmount, setBetAmount] = useState('0.1')
  const [gameHistory, setGameHistory] = useState<GameResult[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [triggerDrop, setTriggerDrop] = useState(false)

  const handleWalletConnected = (connectedWallet: ArkWallet) => {
    setConnectedWallet(connectedWallet)
  }

  const handleDisconnect = () => {
    setConnectedWallet(null)
    showNotification('Wallet disconnected')
  }

  const handleBalanceUpdate = (newBalance: string) => {
    if (connectedWallet) {
      setConnectedWallet({
        ...connectedWallet,
        balance: newBalance
      })
    }
  }

  const handleBallLanded = async (multiplier: number) => {
    setIsPlaying(false)
    
    const bet = parseFloat(betAmount)
    const payout = bet * multiplier
    const isWin = multiplier >= 1.0

    console.log('Ball landed!', { multiplier, bet, payout, isWin })

    if (!connectedWallet) {
      showNotification('Wallet not connected', 'error')
      return
    }

    let transactionId: string | undefined

    try {
      if (isWin) {
        console.log('Player won! Sending winning transaction...')
        
        const response = await fetch('/.netlify/functions/send-winnings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientAddress: connectedWallet.address,
            amount: payout
          })
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            transactionId = result.transactionId
            showNotification(`You won ${payout} ARK! Transaction: ${transactionId.substring(0, 10)}...`, 'success')
          } else {
            throw new Error(result.error || 'Failed to send winnings')
          }
        } else {
          throw new Error(`Server error: ${response.status}`)
        }
      } else {
        console.log('Player lost. Sending loss transaction...')
        
        const txId = await sendLossTransaction(LOSS_ADDRESS, bet, connectedWallet)
        if (txId) {
          transactionId = txId
          showNotification(`You lost ${bet} ARK. Better luck next time!`, 'error')
        } else {
          throw new Error('Failed to process loss transaction')
        }
      }

      const gameResult: GameResult = {
        betAmount: bet,
        multiplier,
        payout: isWin ? payout : 0,
        isWin,
        transactionId,
        timestamp: Date.now()
      }

      setGameHistory(prev => [gameResult, ...prev.slice(0, 9)])
      
      if (window.arkconnect) {
        await handleBalanceUpdate(await window.arkconnect.getBalance())
      }

    } catch (error: any) {
      console.error('Transaction error:', error)
      showNotification(`Transaction failed: ${error.message}`, 'error')
    }
  }

  const playGame = () => {
    if (!connectedWallet) {
      showNotification('Please connect your ARK wallet first', 'error')
      return
    }

    const bet = parseFloat(betAmount)
    if (isNaN(bet) || bet < 0.0001) {
      showNotification('Minimum bet is 0.0001 ARK', 'error')
      return
    }

    if (bet > 5) {
      showNotification('Maximum bet is 5 ARK', 'error')
      return
    }

    const walletBalance = parseFloat(connectedWallet.balance)
    if (walletBalance < bet + ARK_TRANSACTION_FEE) {
      showNotification('Insufficient balance for bet + transaction fee', 'error')
      return
    }

    setIsPlaying(true)
    setTriggerDrop(true)
    showNotification(`Bet placed: ${bet} ARK`)
  }

  const handleTriggerComplete = () => {
    setTriggerDrop(false)
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">ARKlinko</h1>
          <p className="text-blue-200">Real ARK blockchain Plinko game</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Canvas */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-center">
                <PlinkoCanvas 
                  onBallLanded={handleBallLanded}
                  triggerDrop={triggerDrop}
                  onTriggerComplete={handleTriggerComplete}
                />
              </div>
            </div>
          </div>

          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            <ArkConnect 
              onWalletConnected={handleWalletConnected}
              onDisconnect={handleDisconnect}
              connectedWallet={connectedWallet}
              onBalanceUpdate={handleBalanceUpdate}
            />

            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-green-600">🎮</span>
                  Game Controls
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Bet Amount (ARK)
                  </label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min="0.0001"
                    max="5"
                    step="0.0001"
                    disabled={isPlaying}
                    className="w-full px-3 py-2 border border-gray-300 rounded font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Min: 0.0001 ARK, Max: 5 ARK
                  </p>
                </div>

                <button 
                  onClick={playGame}
                  disabled={!connectedWallet || isPlaying}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-lg font-semibold"
                >
                  {isPlaying ? 'Ball Dropping...' : 'Drop Ball'}
                </button>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Transaction fee: {ARK_TRANSACTION_FEE} ARK</p>
                  <p>• Losses sent to: {LOSS_ADDRESS.substring(0, 20)}...</p>
                  <p>• Winnings sent directly to your wallet</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-orange-600">🕐</span>
                  Recent Games
                </h3>
              </div>
              <div className="p-4">
                {gameHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No games played yet</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {gameHistory.map((game, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className={`text-xl ${game.isWin ? 'text-green-600' : 'text-red-600'}`}>
                            {game.isWin ? '📈' : '📉'}
                          </span>
                          <div>
                            <p className="font-medium">
                              {game.multiplier}x multiplier
                            </p>
                            <p className="text-sm text-gray-600">
                              Bet: {game.betAmount} ARK
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${
                            game.isWin 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {game.isWin ? `+${game.payout.toFixed(4)}` : `-${game.betAmount}`} ARK
                          </span>
                          {game.transactionId && (
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                              TX: {game.transactionId.substring(0, 10)}...
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
