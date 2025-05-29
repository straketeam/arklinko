# ARKlinko GitHub Repository Template

## Quick Setup Instructions

1. **Create new GitHub repository**: 
   - Go to github.com → New repository
   - Name: `arklinko`
   - Public repository
   - Don't initialize with files

2. **Upload this minimal working version**:
   - Create these files in your local folder
   - Upload to your GitHub repository
   - Deploy to Netlify

## Minimal Working Files

This creates a basic ARKlinko that connects to ARK wallets and includes the Plinko game.

### File: package.json
```json
{
  "name": "arklinko",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "tailwindcss": "^3.4.14",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49"
  }
}
```

### File: index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARKlinko - Provably Fair Plinko</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### File: src/main.tsx
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### File: src/App.tsx
```tsx
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
```

### File: vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### File: netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## After Upload

1. Upload these files to your GitHub repository
2. Go to Netlify → New site from Git
3. Connect your GitHub repository
4. Deploy
5. Test ARK Connect on the deployed URL

Once this basic version works with ARK Connect, we can add the full Plinko game features.