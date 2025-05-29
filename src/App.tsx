import React, { useState, useEffect } from 'react'

function App() {
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
    console.log(info)
  }

  useEffect(() => {
    addDebugInfo('🔥 NEW VERSION LOADED - TEST SUCCESSFUL!')
    
    let attempts = 0
    const maxAttempts = 10
    
    const checkForArkConnect = () => {
      attempts++
      addDebugInfo(`🔍 Checking for ARK Connect (attempt ${attempts}/${maxAttempts})...`)
      
      const arkProvider = (window as any).arkconnect || (window as any).ark
      
      if (arkProvider) {
        addDebugInfo(`✅ ARK Connect found on attempt ${attempts}!`)
        addDebugInfo(`📋 Available methods: ${Object.keys(arkProvider).join(', ')}`)
        addDebugInfo(`📋 Available properties: ${Object.getOwnPropertyNames(arkProvider).join(', ')}`)
        
        // Check if it's connected
        if (arkProvider.isConnected) {
          const connected = arkProvider.isConnected()
          addDebugInfo(`🔗 isConnected(): ${connected}`)
        }
        
        // Check for wallet data in various locations
        const walletPaths = ['wallet', 'account', 'connectedAccount', 'activeAccount', 'currentAccount']
        walletPaths.forEach(path => {
          if (arkProvider[path]) {
            addDebugInfo(`💰 ${path}: ${JSON.stringify(arkProvider[path])}`)
          }
        })
        
        // Try calling methods
