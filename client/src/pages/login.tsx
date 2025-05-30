import { useState } from "react";
import ArkConnect from "@/components/ark-connect";
import arkLogo from "@assets/Logo_ARK.io.png";

interface ArkWallet {
  address: string;
  balance: string;
  publicKey: string;
}

export default function Login() {
  const [connectedWallet, setConnectedWallet] = useState<ArkWallet | null>(null);

  const handleWalletConnected = async (wallet: ArkWallet) => {
    setConnectedWallet(wallet);
  };

  const handleDisconnect = () => {
    setConnectedWallet(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img 
              src={arkLogo} 
              alt="ARK Logo" 
              className="w-16 h-16 object-contain"
            />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              ARKlinko
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Connect your ARK wallet to start playing
          </p>
        </div>

        <ArkConnect 
          onWalletConnected={handleWalletConnected}
          onDisconnect={handleDisconnect}
          connectedWallet={connectedWallet}
        />

        <div className="mt-8 text-center">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2 text-orange-400">How to Play</h3>
            <ul className="text-sm text-gray-400 space-y-1 text-left">
              <li>• Connect your ARK wallet using ARK Connect</li>
              <li>• Set your bet amount in ARK</li>
              <li>• Drop the ball and watch it bounce</li>
              <li>• Win based on which multiplier slot it lands in</li>
              <li>• Your real ARK balance updates instantly</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Don't have ARK Connect?{" "}
            <a 
              href="https://arkconnect.io/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-red-400 hover:text-red-300 underline"
            >
              Get it here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
