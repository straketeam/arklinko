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

  const multipliers = [0.1, 0.3, 0.5, 0.8, 1.2, 1.8, 2.5, 4.0, 8.0, 16.0, 8.0, 4.0, 2.5, 1.8, 1.2, 0.8, 0.5, 0.3, 0.1]

  useEffect(() => {
    const pegs: Peg[] = []
    const rows = 16
    const startY = 80
    const rowSpacing = 28
    
    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 3
      const spacing = 42
      const rowWidth = (pegsInRow - 1) * spacing
      const startX = (CANVAS_WIDTH - rowWidth) / 2
      
      for (let i = 0; i < pegsInRow; i++) {
        pegs.push({
          x: startX + i * spacing,
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

    pegsRef.current.forEach(peg => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.beginPath()
      ctx.arc(peg.x + 2, peg.y + 2, peg.radius, 0, Math.PI * 2)
      ctx.fill()
      
      const gradient = ctx.createRadialGradient(peg.x - 2, peg.y - 2, 0, peg.x, peg.y, peg.radius)
      gradient.addColorStop(0, '#C084FC')
      gradient.addColorStop(1, '#7C3AED')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.beginPath()
      ctx.arc(peg.x - 1, peg.y - 1, peg.radius * 0.4, 0, Math.PI * 2)
      ctx.fill()
    })

    const boxWidth = CANVAS_WIDTH / multipliers.length
    const boxHeight = 50
    const boxY = CANVAS_HEIGHT - boxHeight

    multipliers.forEach((multiplier, index) => {
      const x = index * boxWidth
      
      let bgColor, borderColor, textColor
      if (multiplier >= 8.0) {
        bgColor = '#DC2626'
        borderColor = '#B91C1C'
        textColor = '#FFFFFF'
      } else if (multiplier >= 4.0) {
        bgColor = '#EA580C'
        borderColor = '#C2410C'
        textColor = '#FFFFFF'
      } else if (multiplier >= 2.0) {
        bgColor = '#059669'
        borderColor = '#047857'
        textColor = '#FFFFFF'
      } else if (multiplier >= 1.0) {
        bgColor = '#0D9488'
        borderColor = '#0F766E'
        textColor = '#FFFFFF'
      } else {
        bgColor = '#4B5563'
        borderColor = '#374151'
        textColor = '#F3F4F6'
      }
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fillRect(x + 2, boxY + 2, boxWidth, boxHeight)
      
      ctx.fillStyle = bgColor
      ctx.fillRect(x, boxY, boxWidth, boxHeight)
      
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 2
      ctx.strokeRect(x, boxY, boxWidth, boxHeight)
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 1, boxY + 1, boxWidth - 2, boxHeight - 2)
      
      ctx.fillStyle = textColor
      ctx.font = 'bold 12px "Courier New", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillText(`${multiplier}x`, x + boxWidth/2 + 1, boxY + boxHeight/2 + 1)
      
      ctx.fillStyle = textColor
      ctx.fillText(`${multiplier}x`, x + boxWidth/2, boxY + boxHeight/2)
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

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.beginPath()
      ctx.arc(ball.x + 2, ball.y + 2, ball.radius, 0, Math.PI * 2)
      ctx.fill()
      
      const ballGradient = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, ball.radius)
      ballGradient.addColorStop(0, '#FCD34D')
      ballGradient.addColorStop(1, '#F59E0B')
      ctx.fillStyle = ballGradient
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#D97706'
      ctx.lineWidth = 2
      ctx.stroke()
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.beginPath()
      ctx.arc(ball.x - 2, ball.y - 2, ball.radius * 0.3, 0, Math.PI * 2)
      ctx.fill()

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
      className="border-2 border-purple-600 rounded-xl shadow-2xl bg-gradient-to-b from-indigo-900 via-purple-900 to-violet-900"
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
