import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider, useWallet } from "@/contexts/wallet-context";
import ARKlinkoBlockchain from "@/pages/arklinko-blockchain";
import Login from "@/pages/login";
import Fairness from "@/pages/fairness";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated } = useWallet();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={ARKlinkoBlockchain} />
      <Route path="/fairness" component={Fairness} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TooltipProvider>
          <div className="dark">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
