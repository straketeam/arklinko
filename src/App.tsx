import React, { useState, useEffect } from 'react'

function App() {
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
    console.log(info)
  }

  useEffect(() => {
    addDebugInfo('NEW VERSION LOADED - TEST SUCCESSFUL!')
    
    let attempts = 0
    const maxAttempts = 10
    
    const checkForArkConnect = () => {
      attempts++
      addDebugInfo(`Checking for ARK Connect (attempt ${attempts}/${maxAttempts})...`)
      
      const arkProvider = (window as any).arkconnect || (window as any).ark
      
      if (arkProvider) {
        addDebugInfo(`ARK Connect found on attempt ${attempts}!`)
        addDebugInfo(`Available methods: ${Object.keys(arkProvider).join(', ')}`)
        addDebugInfo(`Available properties: ${Object.getOwnPropertyNames(arkProvider).join(', ')}`)
        
        if (arkProvider.isConnected) {
          const connected = arkProvider.isConnected()
          addDebugInfo(`isConnected(): ${connected}`)
        }
        
        const walletPaths = ['wallet', 'account', 'connectedAccount', 'activeAccount', 'currentAccount']
        walletPaths.forEach(path => {
          if (arkProvider[path]) {
            addDebugInfo(`${path}: ${JSON.stringify(arkProvider[path])}`)
          }
        })
        
        return
      }
      
      if (attempts < maxAttempts) {
        addDebugInfo(`ARK Connect not found yet, will try again...`)
        setTimeout(checkForArkConnect, 1000)
      } else {
        addDebugInfo(`ARK Connect not found after ${maxAttempts} attempts`)
      }
    }
    
    checkForArkConnect()
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">ARK Connect Test</h1>
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
