import React, { useState, useEffect } from 'react'

interface ArkWallet {
  address: string
  balance: string
  network: string
}

function App() {
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [wallet, setWallet] = useState<ArkWallet | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
    console.log(info)
  }

  useEffect(() => {
    addDebugInfo('Checking for ARK Connect extension...')
    
    const checkConnection = async () => {
      if (window.arkconnect) {
        addDebugInfo('ARK Connect extension found!')
        
        try {
          const isConnected = await window.arkconnect.isConnected()
          addDebugInfo(`Connected: ${isConnected}`)
          
          if (isConnected) {
            await loadWalletData()
          }
        } catch (error: any) {
          addDebugInfo(`Error checking connection: ${error.message}`)
        }
      } else {
        addDebugInfo('ARK Connect extension not found')
      }
    }
    
    const loadWalletData = async () => {
      try {
        const address = await window.arkconnect!.getAddress()
        const balance = await window.arkconnect!.getBalance()
        const network = await window.arkconnect!.getNetwork()
        
        addDebugInfo(`Address: ${address}`)
        addDebugInfo(`Balance: ${balance}`)
        addDebugInfo(`Network: ${network}`)
        
        setWallet({
          address,
          balance,
          network
        })
      } catch (error: any) {
        addDebugInfo(`Error loading wallet data: ${error.message}`)
      }
    }
    
    // Set up event listeners
    if (window.arkconnect) {
      window.arkconnect.on?.('connected', (data) => {
        addDebugInfo('Connected event received')
        loadWalletData()
      })
      
      window.arkconnect.on?.('disconnected', (data) => {
        addDebugInfo('Disconnected event received')
        setWallet(null)
      })
      
      window.arkconnect.on?.('addressChanged', (data) => {
        addDebugInfo(`Address changed: ${JSON.stringify(data)}`)
        loadWalletData()
      })
    }
    
    setTimeout(checkConnection, 2000)
  }, [])

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)
    addDebugInfo('Attempting to connect wallet...')
    
    try {
      if (!window.arkconnect) {
        throw new Error('ARK Connect extension not found')
      }
      
      await window.arkconnect.connect()
      addDebugInfo('Connection request sent')
      
      // After successful connection, load wallet data
      const address = await window.arkconnect.getAddress()
      const balance = await window.arkconnect.getBalance()
      const network = await window.arkconnect.getNetwork()
      
      setWallet({
        address,
        balance,
        network
      })
      
      addDebugInfo('Wallet connected successfully')
    } catch (error: any) {
      addDebugInfo(`Connection failed: ${error.message}`)
      setError(error.message)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      if (window.arkconnect) {
        await window.arkconnect.disconnect()
        addDebugInfo('Disconnect request sent')
      }
    } catch (error: any) {
      addDebugInfo(`Disconnect error: ${error.message}`)
    }
  }

  // Type declaration for window.arkconnect
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

  if (wallet) {
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
            <p className="text-sm">Network: {wallet.network}</p>
            <button 
              onClick={disconnectWallet}
              className="text-red-400 text-sm hover:text-red-300 mt-2"
            >
              Disconnect
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-xl text-green-400">ARK Connect Working!</p>
            <p className="text-gray-400">Ready to build the full Plinko game</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">ARKlinko</h1>
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
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg disabled:opacity-50 mb-4"
        >
          {isConnecting ? 'Connecting...' : 'Connect ARK Wallet'}
        </button>
        
        <div className="text-xs text-gray-500 text-center mb-4">
          <p>Requires ARK Connect browser extension</p>
          <p>Download from <a href="https://arkconnect.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">arkconnect.io</a></p>
        </div>
        
        <div className="text-xs text-gray-400">
          <h3 className="font-semibold mb-2">Debug Information:</h3>
          <div className="p-3 bg-gray-900 rounded max-h-40 overflow-y-auto">
            {debugInfo.map((info, index) => (
              <div key={index} className="font-mono text-xs mb-1">{info}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
