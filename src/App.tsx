import React, { useState, useEffect } from 'react'

function App() {
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [wallet, setWallet] = useState<any>(null)

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
    console.log(info)
  }

  useEffect(() => {
    addDebugInfo('NEW VERSION LOADED - TEST SUCCESSFUL!')
    
    const checkForArkConnect = async () => {
      addDebugInfo('Looking for ARK Connect...')
      
      const arkProvider = (window as any).arkconnect || (window as any).ark
      
      if (arkProvider) {
        addDebugInfo('ARK Connect found!')
        
        // Check if there's a request method (common in wallet extensions)
        if (arkProvider.request) {
          addDebugInfo('Found request method, trying to get accounts...')
          try {
            const accounts = await arkProvider.request({ method: 'ark_accounts' })
            addDebugInfo(`ark_accounts result: ${JSON.stringify(accounts)}`)
            if (accounts && accounts[0]) {
              setWallet({ address: accounts[0], balance: '0.00000000', publicKey: '' })
              return
            }
          } catch (err: any) {
            addDebugInfo(`ark_accounts failed: ${err.message}`)
          }
          
          try {
            const wallet = await arkProvider.request({ method: 'ark_requestAccounts' })
            addDebugInfo(`ark_requestAccounts result: ${JSON.stringify(wallet)}`)
            if (wallet && wallet[0]) {
              setWallet({ address: wallet[0], balance: '0.00000000', publicKey: '' })
              return
            }
          } catch (err: any) {
            addDebugInfo(`ark_requestAccounts failed: ${err.message}`)
          }
        }
        
        // Check window.ethereum style API
        if ((window as any).ethereum?.isArk) {
          addDebugInfo('Found ethereum.isArk, trying ethereum-style API...')
          try {
            const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' })
            addDebugInfo(`eth_accounts result: ${JSON.stringify(accounts)}`)
          } catch (err: any) {
            addDebugInfo(`eth_accounts failed: ${err.message}`)
          }
        }
        
        // Look for ARK-specific global objects
        const arkGlobals = Object.keys(window).filter(key => key.toLowerCase().includes('ark'))
        if (arkGlobals.length > 0) {
          addDebugInfo(`Found ARK globals: ${arkGlobals.join(', ')}`)
          arkGlobals.forEach(global => {
            const obj = (window as any)[global]
            if (obj && typeof obj === 'object') {
              addDebugInfo(`${global} methods: ${Object.keys(obj).join(', ')}`)
            }
          })
        }
        
        addDebugInfo('ARK Connect is connected but wallet info not accessible via standard API')
        
        return
      }
      
      addDebugInfo('ARK Connect not found')
    }
    
    setTimeout(checkForArkConnect, 2000)
  }, [])

  if (wallet) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-4xl font-bold mb-6">ARKlinko</h1>
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <p>Connected: {wallet.address}</p>
          <p>Balance: {wallet.balance} ARK</p>
        </div>
        <p className="text-green-400 text-xl">Connection successful! Ready for Plinko game.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">ARK Connect Analysis</h1>
      
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl mb-4">Debug Information:</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {debugInfo.map((info, index) => (
            <div key={index} className="text-sm font-mono bg-gray-700 p-2 rounded">
              {info}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
