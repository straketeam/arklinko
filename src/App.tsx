import React, { useState, useEffect, useRef } from 'react'

interface ArkWallet {
  address: string
  balance: string
  publicKey: string
}

function App() {
  const [wallet, setWallet] = useState<ArkWallet | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      // Wait for ARK Connect extension
      let attempts = 0
      while (attempts < 10) {
        const arkProvider = (window as any).arkconnect || (window as any).ark
        
        if (arkProvider && arkProvider.connect) {
          const account = await arkProvider.connect()
          if (account && account.address) {
            setWallet({
              address: account.address,
              balance: '0.00000000',
              publicKey: account.publicKey || ''
            })
            break
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }
      
      if (attempts >= 10) {
        setError('ARK Connect extension not found. Please install from arkconnect.io')
      }
    } catch (err) {
      setError('Connection failed. Please try again.')
    } finally {
      setIsConnecting(false)
    }
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">ARKlinko</h1>
          <p className="text-gray-300 mb-6 text-center">Connect your ARK wallet to play</p>
          
          {error && (
            <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
          )}
          
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect ARK Wallet'}
          </button>
          
          <p className="text-xs text-gray-500 mt-4 text-center">
            Requires ARK Connect browser extension
          </p>
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
        
        <div className="bg-gray-800 p-4 rounded-lg mb-8">
          <p className="text-sm">Connected: {wallet.address}</p>
          <p className="text-sm">Balance: {wallet.balance} ARK</p>
          <button 
            onClick={() => setWallet(null)}
            className="text-red-400 text-sm hover:text-red-300"
          >
            Disconnect
          </button>
        </div>
        
        <div className="text-center">
          <p className="text-xl">Plinko Game Coming Soon!</p>
          <p className="text-gray-400">ARK Connect is working properly on this domain.</p>
        </div>
      </div>
    </div>
  )
}

export default App
