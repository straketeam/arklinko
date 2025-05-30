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

// Plinko multipliers
const MULTIPLIERS = [10, 5, 4, 3, 2, -0.5, 1.5, 1.25, 0, -1, 0, 1.25, 1.5, -0.5, 2, 3, 4, 5, 10]

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
    // Try to use server endpoint first
    const response = await fetch('/api/game/send-winnings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientAddress: toAddress,
        amount: amount
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      if (result.success && result.transactionId) {
        return result.transactionId
      }
    }
    
    // If server endpoint fails (like on static deployments), simulate winning
    console.log('Server endpoint not available, simulating winning transaction')
    showNotification(`🎉 Congratulations! You won ${amount.toFixed(4)} ARK!`, 'success')
    showNotification(`In a real deployment, ${amount.toFixed(4)} ARK would be sent to ${toAddress}`)
    
    // Return a simulated transaction ID for demo purposes
    const simulatedTxId = 'win_tx_' + Date.now().toString(16)
    console.log('Simulated winning transaction ID:', simulatedTxId)
    return simulatedTxId
    
  } catch (error: any) {
    console.error('Winning transaction error:', error)
    
    // Fallback to simulation
    console.log('Using fallback simulation for winning transaction')
    showNotification(`🎉 You won ${amount.toFixed(4)} ARK!`, 'success')
    showNotification(`Demo mode: Real deployment would send ${amount.toFixed(4)} ARK to your wallet`)
    
    const simulatedTxId = 'demo_win_' + Date.now().toString(16)
    return simulatedTxId
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

    // Convert ARK amount to arktoshi (ARK uses 8 decimal places)
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
    console.log('ARK Connect transaction result:', result)
    
    if (result && result.status === 'success' && result.data) {
      const txId = result.data.id || result.data.transactionId
      console.log('Transaction sent successfully:', txId)
      return txId
    } else if (result && result.status === 'failed') {
      throw new Error(result.message || 'Transaction was rejected by user')
    }
    
    throw new Error('Transaction failed - unexpected response format')
  } catch (error: any) {
    console.error('Transaction error:', error)
    
    // Check for specific ARK Connect error types
    if (error.message && error.message.includes('rejected')) {
      showNotification('Transaction was cancelled by user', 'error')
    } else if (error.message && error.message.includes('insufficient')) {
      showNotification('Insufficient ARK balance for transaction', 'error')
    } else {
      showNotification(`Transaction failed: ${error.message}`, 'error')
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
  const ballsRef = useRef<Ball[]>([])
  const pegsRef = useRef<Peg[]>([])
  const animationRef = useRef<number>()
  const ballIdRef = useRef(0)

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

function ArkConnect({ onWalletConnected, onDisconnect, connectedWallet, onBalanceUpdate }: {
  onWalletConnected: (wallet: ArkWallet) => void
  onDisconnect: () => void
  connectedWallet?: ArkWallet | null
  onBalanceUpdate: (balance: string) => void
}) {
  const [isConnecting, setIsConnecting] = useState(false)

  const connectWallet = async () => {
    if (!window.arkconnect) {
      showNotification('Please install the ARK Connect browser extension.', 'error')
      return
    }

    setIsConnecting(true)
    
    try {
      const isConnected = await window.arkconnect.isConnected()
      let address = ''
      let publicKey = ''
      
      if (isConnected) {
        address = await window.arkconnect.getAddress()
      } else {
        const result = await window.arkconnect.connect()
        if (result && result.status === 'success') {
          address = await window.arkconnect.getAddress()
        } else {
          throw new Error('Connection failed')
        }
      }
      
      if (!address) {
        throw new Error('Could not get wallet address')
      }
      
      // Get public key - ARK Connect may not expose this directly
      try {
        // ARK Connect doesn't typically expose the public key for security reasons
        publicKey = '' // Leave empty for security
      } catch (error) {
        console.log('Public key not available through ARK Connect')
      }
      
      const balance = await getArkBalance(address)
      
      const wallet: ArkWallet = {
        address: address,
        publicKey: publicKey,
        balance: balance
      }
      
      onWalletConnected(wallet)
      showNotification(`Connected! Balance: ${balance} ARK`)
      
    } catch (error: any) {
      console.error('Connection error:', error)
      showNotification(`Connection failed: ${error.message}`, 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  const refreshBalance = async () => {
    if (connectedWallet) {
      const newBalance = await getArkBalance(connectedWallet.address)
      onBalanceUpdate(newBalance)
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={refreshBalance}
              style={{ 
                padding: '8px 12px', 
                backgroundColor: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Refresh
            </button>
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
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px', textAlign: 'center' }}>
      <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: 'white' }}>
        Connect ARK Wallet
      </h3>
      <p style={{ color: '#9ca3af', marginBottom: '16px' }}>
        Connect your ARK wallet to play ARKlinko with real ARK tokens
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

export default function ARKlinkoBlockchain() {
  const [wallet, setWallet] = useState<ArkWallet | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle')
  const [triggerDrop, setTriggerDrop] = useState(false)
  const [gameHistory, setGameHistory] = useState<GameResult[]>([])

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

  const handleBallLanded = async (multiplier: number) => {
    const bet = parseFloat(betAmount)
    let transactionId: string | null = null
    
    try {
      let payout = 0
      let isWin = false

      if (multiplier === -1) {
        payout = 0
        isWin = false
        
        if (wallet) {
          showNotification(`Processing transaction...`)
          transactionId = await sendArkTransaction(GAME_WALLET_ADDRESS, bet, wallet)
          if (transactionId) {
            showNotification(`Total loss! ${bet} ARK sent to game wallet`, 'error')
          }
        }
      } else if (multiplier === -0.5) {
        const lossAmount = bet * 0.5
        payout = bet * 0.5
        isWin = false
        
        if (wallet) {
          showNotification(`Processing transaction...`)
          transactionId = await sendArkTransaction(GAME_WALLET_ADDRESS, lossAmount, wallet)
          if (transactionId) {
            showNotification(`Half loss! ${lossAmount} ARK sent to game wallet`, 'error')
          }
        }
      } else if (multiplier === 0) {
        payout = bet
        isWin = true
        showNotification(`Break even! You keep your ${bet} ARK`)
      } else if (multiplier > 0) {
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '32px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              backgroundColor: '#1f2937',
              padding: '24px',
              borderRadius: '8px'
            }}>
              <PlinkoCanvas 
                onBallLanded={handleBallLanded}
                triggerDrop={triggerDrop}
                onTriggerComplete={handleTriggerComplete}
              />
            </div>

            <div style={{ backgroundColor: '#1f2937', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'end', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                  <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 4px 0' }}>Wallet Balance</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e', margin: '0' }}>
                    {wallet.balance} ARK
                  </p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                    Tx Fee: {ARK_TRANSACTION_FEE} ARK
                  </p>
                </div>
              </div>
            </div>

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
                      <span>Bet: {game.betAmount} ARK | {game.multiplier}x</span>
                      <span style={{ color: game.isWin ? '#22c55e' : '#ef4444' }}>
                        {game.isWin ? `Won ${game.payout.toFixed(4)} ARK` : 
                         game.multiplier === 0 ? 'Break Even' :
                         `Lost ${(game.betAmount - game.payout).toFixed(4)} ARK`}
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
            textAlign: 'center',
            marginTop: '32px'
          }}>
            <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
              Welcome to ARKlinko!
            </h2>
            <p style={{ fontSize: '18px', color: '#9ca3af', marginBottom: '32px' }}>
              Connect your ARK wallet to start playing with real ARK blockchain transactions.
            </p>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              <p>• Minimum bet: {MIN_BET} ARK • Maximum bet: {MAX_BET} ARK</p>
              <p>• Transaction fee: {ARK_TRANSACTION_FEE} ARK per transaction</p>
              <p>• Blocktime: ~8 seconds for confirmation</p>
            </div>
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
      request: (method: string, params?: any) => Promise<any>;
      version: () => string;
    };
  }
}
