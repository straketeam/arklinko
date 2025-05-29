import React, { useState, useEffect } from 'react'

interface ArkWallet {
  address: string
  balance: string
  publicKey: string
}

function App() {
  const [wallet, setWallet] = useState<ArkWallet | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${info}`])
    console.log(info)
  }

  useEffect(() => {
    // Check for ARK Connect on page load
    addDebugInfo('Checking for ARK Connect extension...')
    
    const checkExtension = () => {
      const arkProvider = (window as any).arkconnect || (window as any).ark
      if (arkProvider) {
        addDebugInfo('ARK Connect detected!')
        
        // Check if already connected
        if (arkProvider.isConnected && arkProvider.isConnected()) {
          addDebugInfo('ARK Connect shows as connected')
          // Try to get existing account
          arkProvider.getAccount?.().then((account: any) => {
            if (account && account.address) {
              addDebugInfo(`Auto-connected to: ${account.address}`)
              setWallet({
                address: account.address,
                balance: '0.00000000',
                publicKey: account.publicKey || ''
              })
            }
          }).catch((err: any) => {
            addDebugInfo(`Auto-connect failed: ${err.message || 'Unknown error'}`)
          })
        }
      } else {
        addDebugInfo('ARK Connect not found in window object')
      }
    }
    
    // Check immediately and after a delay
    checkExtension()
    setTimeout(checkExtension, 2000)
  }, [])

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)
    addDebugInfo('Starting connection attempt...')
    
    try {
      // Check multiple possible locations for ARK Connect
      const providers = [
        (window as any).arkconnect,
        (window as any).ark,
        (window as any).ARK,
        (window as any).ethereum?.arkconnect
      ]
      
      let arkProvider = null
      for (let i = 0; i < providers.length; i++) {
        if (providers[i]) {
          addDebugInfo(`Found provider at index ${i}`)
          arkProvider = providers[i]
          break
        }
      }
      
      if (!arkProvider) {
        // Wait and try again
        addDebugInfo('No provider found, waiting for extension to load...')
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Try again
        for (let i = 0; i < providers.length; i++) {
          if (providers[i]) {
            addDebugInfo(`Found provider at index ${i} on second attempt`)
            arkProvider = providers[i]
            break
          }
        }
      }
      
      if (!arkProvider) {
        throw new Error('ARK Connect extension not found. Please install from arkconnect.io and refresh the page.')
      }
      
      if (!arkProvider.connect || typeof arkProvider.connect !== 'function') {
        throw new Error('ARK Connect extension found but connect method not available.')
      }
      
      addDebugInfo('Calling arkProvider.connect()...')
      const account = await arkProvider.connect()
      addDebugInfo(`Connect returned: ${JSON.stringify(account)}`)
      
      if (account && account.address) {
        addDebugInfo(`Successfully connected: ${account.address}`)
        setWallet({
          address: account.address,
          balance: '0.00000000',
          publicKey: account.publicKey || ''
        })
      } else {
        throw new Error('No account returned from ARK Connect')
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown connection error'
      addDebugInfo(`Connection failed: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }

  if (!wallet) {
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
          
          {/* Debug Information */}
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-300">Debug Information</summary>
            <div className="mt-2 p-2 bg-gray-900 rounded max-h-40 overflow-y-auto">
              {debugInfo.map((info, index) => (
                <div key={index} className="font-mono">{info}</div>
              ))}
            </div>
          </details>
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
            className="text-red-400 text-sm hover:text-red-300 mt-2"
          >
            Disconnect
          </button>
        </div>
        
        <div className="text-center">
          <p className="text-xl text-green-400">ARK Connect Working!</p>
          <p className="text-gray-400">Full Plinko game features coming next...</p>
        </div>
      </div>
    </div>
  )
}

export default App
