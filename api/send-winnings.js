const crypto = require('crypto');

// ARK helper functions
function createArkWalletFromPassphrase(passphrase) {
  const elliptic = require("elliptic");
  const bs58check = require("bs58check");

  // Create elliptic curve instance (secp256k1 used by ARK)
  const ec = new elliptic.ec("secp256k1");

  // Generate private key from 24-word passphrase
  const hash = crypto
    .createHash("sha256")
    .update(passphrase, "utf8")
    .digest();
  const privateKey = hash.toString("hex");

  // Generate key pair
  const keyPair = ec.keyFromPrivate(privateKey, "hex");
  const publicKey = keyPair.getPublic("hex");

  // Generate ARK address from public key
  const publicKeyBuffer = Buffer.from(publicKey, "hex");
  const publicKeyHash = crypto.createHash("ripemd160")
    .update(crypto.createHash("sha256").update(publicKeyBuffer).digest())
    .digest();

  // Add network version byte (0x17 for ARK mainnet)
  const versionedHash = Buffer.concat([Buffer.from([0x17]), publicKeyHash]);
  const address = bs58check.encode(versionedHash);

  return {
    address,
    publicKey,
    privateKey,
    passphrase,
  };
}

function serializeTransaction(transaction) {
  const bs58check = require("bs58check");
  const buffer = Buffer.alloc(256);
  let offset = 0;

  // Version (1 byte)
  buffer.writeUInt8(transaction.version, offset);
  offset += 1;

  // Network (1 byte)
  buffer.writeUInt8(transaction.network, offset);
  offset += 1;

  // Type Group (4 bytes)
  buffer.writeUInt32LE(transaction.typeGroup, offset);
  offset += 4;

  // Type (2 bytes)
  buffer.writeUInt16LE(transaction.type, offset);
  offset += 2;

  // Nonce (8 bytes)
  const nonce = BigInt(transaction.nonce);
  buffer.writeBigUInt64LE(nonce, offset);
  offset += 8;

  // Sender Public Key (33 bytes)
  Buffer.from(transaction.senderPublicKey, "hex").copy(buffer, offset);
  offset += 33;

  // Fee (8 bytes)
  const fee = BigInt(transaction.fee);
  buffer.writeBigUInt64LE(fee, offset);
  offset += 8;

  // Amount (8 bytes)
  const amount = BigInt(transaction.amount);
  buffer.writeBigUInt64LE(amount, offset);
  offset += 8;

  // Recipient (21 bytes)
  bs58check.decode(transaction.recipientId).copy(buffer, offset);
  offset += 21;

  // Vendor Field
  if (transaction.vendorField) {
    const vendorField = Buffer.from(transaction.vendorField, "utf8");
    buffer.writeUInt8(vendorField.length, offset);
    offset += 1;
    vendorField.copy(buffer, offset);
    offset += vendorField.length;
  } else {
    buffer.writeUInt8(0, offset);
    offset += 1;
  }

  return buffer.slice(0, offset);
}

// Real ARK blockchain transaction sending
async function sendArkWinningTransaction(recipientAddress, amount) {
  try {
    const passphrase = process.env.ARK_PRIVATE_KEY;
    if (!passphrase) {
      throw new Error('ARK_PRIVATE_KEY not configured');
    }
    
    console.log('Sending real ARK winning transaction to:', recipientAddress, 'Amount:', amount);
    
    // Create wallet from 24-word passphrase
    const wallet = createArkWalletFromPassphrase(passphrase);
    console.log('Game wallet address:', wallet.address);
    
    // Get current nonce for the game wallet
    const walletResponse = await fetch(`https://wallets.ark.io/api/wallets/${wallet.address}`);
    const walletData = await walletResponse.json();
    const currentNonce = walletData.data?.nonce ? parseInt(walletData.data.nonce) + 1 : 1;
    
    console.log('Current nonce for game wallet:', currentNonce);
    
    // Convert ARK amount to arktoshi
    const amountInArktoshi = Math.floor(amount * 100000000);
    const feeInArktoshi = 600000; // 0.006 ARK standard fee
    
    // Create transaction object
    const transaction = {
      version: 2,
      network: 23, // ARK Mainnet
      typeGroup: 1,
      type: 0, // Transfer
      nonce: currentNonce.toString(),
      senderPublicKey: wallet.publicKey,
      fee: feeInArktoshi.toString(),
      amount: amountInArktoshi.toString(),
      recipientId: recipientAddress,
      vendorField: `ARKlinko win payout ${amount} ARK`
    };
    
    // Serialize and sign transaction
    const transactionBytes = serializeTransaction(transaction);
    const transactionHash = crypto.createHash('sha256').update(transactionBytes).digest();
    
    // Sign with elliptic
    const elliptic = require("elliptic");
    const ec = new elliptic.ec('secp256k1');
    const keyPair = ec.keyFromPrivate(wallet.privateKey, 'hex');
    const signature = keyPair.sign(transactionHash);
    const signatureBuffer = Buffer.from(signature.toDER());
    
    // Add signature to transaction
    const signedTransaction = {
      ...transaction,
      signature: signatureBuffer.toString('hex')
    };
    
    // Calculate transaction ID
    const fullTransactionBytes = Buffer.concat([transactionBytes, signatureBuffer]);
    const transactionId = crypto.createHash('sha256').update(fullTransactionBytes).digest('hex');
    
    console.log('Created transaction with ID:', transactionId);
    
    // Broadcast to ARK network
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
      return acceptedTxId;
    } else if (broadcastResult.errors) {
      console.error('Transaction broadcast errors:', broadcastResult.errors);
      throw new Error(`Transaction rejected: ${JSON.stringify(broadcastResult.errors)}`);
    }
    
    return transactionId;
  } catch (error) {
    console.error('ARK winning transaction error:', error);
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipientAddress, amount } = req.body;
    
    if (!recipientAddress || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    console.log('Processing real winning transaction:', { recipientAddress, amount });
    
    // Send winning transaction from game wallet using real ARK blockchain
    const transactionId = await sendArkWinningTransaction(recipientAddress, amount);
    
    if (transactionId) {
      res.json({ success: true, transactionId });
    } else {
      res.status(500).json({ success: false, error: 'Transaction failed' });
    }
  } catch (error) {
    console.error('Send winnings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
