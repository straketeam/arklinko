const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { recipientAddress, amount } = JSON.parse(event.body);
    
    if (!recipientAddress || !amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    // Get ARK private key from environment
    const arkPrivateKey = process.env.ARK_PRIVATE_KEY;
    if (!arkPrivateKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'ARK private key not configured' })
      };
    }

    console.log('Processing winning transaction:', { recipientAddress, amount });

    // Create ARK wallet from private key
    const elliptic = require('elliptic');
    const bs58check = require('bs58check');
    const ec = new elliptic.ec('secp256k1');

    // Generate private key hash from passphrase
    const hash = crypto.createHash('sha256').update(arkPrivateKey, 'utf8').digest();
    const privateKey = hash.toString('hex');
    
    // Generate key pair and address
    const keyPair = ec.keyFromPrivate(privateKey, 'hex');
    const publicKey = keyPair.getPublic('hex');
    
    const publicKeyBuffer = Buffer.from(publicKey, 'hex');
    const publicKeyHash = crypto.createHash('ripemd160')
      .update(crypto.createHash('sha256').update(publicKeyBuffer).digest())
      .digest();
    
    const versionedHash = Buffer.concat([Buffer.from([0x17]), publicKeyHash]);
    const senderAddress = bs58check.encode(versionedHash);

    // Create ARK transaction
    const amountInArktoshi = Math.floor(amount * 100000000);
    const feeInArktoshi = 600000; // 0.006 ARK
    const timestamp = Math.floor(Date.now() / 1000);

    const transaction = {
      type: 0,
      typeGroup: 1,
      version: 2,
      network: 23, // ARK mainnet
      timestamp: timestamp - 1490101200, // ARK epoch
      senderPublicKey: publicKey,
      fee: feeInArktoshi,
      amount: amountInArktoshi,
      recipientId: recipientAddress,
      vendorField: `ARKlinko winning ${amount} ARK`,
      nonce: timestamp.toString()
    };

    // Serialize transaction for signing
    function serializeTransaction(tx) {
      const buffer = Buffer.alloc(256);
      let offset = 0;
      
      buffer.writeUInt8(tx.type, offset); offset += 1;
      buffer.writeUInt8(tx.typeGroup, offset); offset += 1;
      buffer.writeUInt8(tx.version, offset); offset += 1;
      buffer.writeUInt8(tx.network, offset); offset += 1;
      buffer.writeUInt32LE(tx.timestamp, offset); offset += 4;
      
      const pubKeyBuffer = Buffer.from(tx.senderPublicKey, 'hex');
      pubKeyBuffer.copy(buffer, offset); offset += 33;
      
      buffer.writeBigUInt64LE(BigInt(tx.fee), offset); offset += 8;
      
      if (tx.vendorField) {
        const vendorFieldBuffer = Buffer.from(tx.vendorField, 'utf8');
        buffer.writeUInt8(vendorFieldBuffer.length, offset); offset += 1;
        vendorFieldBuffer.copy(buffer, offset); offset += vendorFieldBuffer.length;
      } else {
        buffer.writeUInt8(0, offset); offset += 1;
      }
      
      buffer.writeBigUInt64LE(BigInt(tx.amount), offset); offset += 8;
      
      const recipientBuffer = bs58check.decode(tx.recipientId);
      recipientBuffer.slice(1).copy(buffer, offset); offset += 20;
      
      return buffer.slice(0, offset);
    }

    // Sign transaction
    const transactionBytes = serializeTransaction(transaction);
    const transactionHash = crypto.createHash('sha256').update(transactionBytes).digest();
    const signature = keyPair.sign(transactionHash);
    const signatureBuffer = Buffer.from(signature.toDER());
    
    const signedTransaction = {
      ...transaction,
      signature: signatureBuffer.toString('hex')
    };

    // Calculate transaction ID
    const fullTransactionBytes = Buffer.concat([transactionBytes, signatureBuffer]);
    const transactionId = crypto.createHash('sha256').update(fullTransactionBytes).digest('hex');

    console.log('Created transaction with ID:', transactionId);

    // Broadcast to ARK network
    const fetch = require('node-fetch');
    const broadcastResponse = await fetch('https://wallets.ark.io/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: [signedTransaction]
      })
    });

    const broadcastResult = await broadcastResponse.json();
    console.log('Broadcast result:', broadcastResult);

    if (broadcastResult.data?.accept?.length > 0) {
      const acceptedTxId = broadcastResult.data.accept[0];
      console.log('Transaction accepted by network:', acceptedTxId);
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: true, transactionId: acceptedTxId })
      };
    } else if (broadcastResult.errors) {
      console.error('Transaction broadcast errors:', broadcastResult.errors);
      
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: `Transaction rejected: ${JSON.stringify(broadcastResult.errors)}` 
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, transactionId })
    };

  } catch (error) {
    console.error('Netlify function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};
