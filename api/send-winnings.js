export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { recipientAddress, amount } = req.body

    if (!recipientAddress || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // For now, return a mock transaction ID
    // In production, this would use the ARK_PRIVATE_KEY environment variable
    const mockTransactionId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    
    return res.status(200).json({ 
      transactionId: mockTransactionId,
      message: 'Transaction sent successfully'
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
