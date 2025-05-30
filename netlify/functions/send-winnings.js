exports.handler = async (event, context) => {
  // Add CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Function started');
    
    const { recipientAddress, amount } = JSON.parse(event.body);
    console.log('Parsed request:', { recipientAddress, amount });
    
    if (!recipientAddress || !amount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    // Get ARK private key from environment
    const arkPrivateKey = process.env.ARK_PRIVATE_KEY;
    console.log('ARK private key available:', !!arkPrivateKey);
    
    if (!arkPrivateKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'ARK private key not configured' })
      };
    }

    console.log('Processing winning transaction:', { recipientAddress, amount });

    // For now, return a test response to verify function works
    // Real ARK transaction implementation needs proper dependencies
    const testTxId = 'netlify_test_' + Date.now();
    console.log('Returning test transaction ID:', testTxId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        transactionId: testTxId,
        message: `Test: Would send ${amount} ARK to ${recipientAddress}`,
        note: "This is a test response - real transactions need proper ARK SDK setup"
      })
    };

  } catch (error) {
    console.error('Netlify function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error'
      })
    };
  }
};
