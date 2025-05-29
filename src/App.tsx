import React, { useState, useEffect } from 'react'

function App() {
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
    console.log(info)
  }

  useEffect(() => {
    addDebugInfo('🔥 NEW VERSION LOADED - TEST SUCCESSFUL!')
    
    const arkProvider = (window as any).arkconnect || (window as any).ark
    
    if (arkProvider) {
      addDebugInfo(`✅ ARK Connect found!`)
      addDebugInfo(`📋 Available methods: ${Object.keys(arkProvider).join(', ')}`)
      
      // Check for specific properties
      if (arkProvider.wallet) {
        addDebugInfo(`💰 wallet property: ${JSON.stringify(arkProvider.wallet)}`)
      }
      if (arkProvider.account) {
        addDebugInfo(`👤 account property: ${JSON.stringify(arkProvider.account)}`)
      }
      if (arkProvider.connectedAccount) {
        addDebugInfo(`🔗 connectedAccount property: ${JSON.stringify(arkProvider.connectedAccount)}`)
      }
    } else {
      addDebugInfo('❌ ARK Connect not found')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">ARK Connect Test</h1>
      
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl mb-4">Debug Information:</h2>
        <div className="space-y-2">
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
