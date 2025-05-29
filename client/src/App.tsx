import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ARKlinko from './pages/plinko-game'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ARKlinko />
    </QueryClientProvider>
  )
}

export default App
