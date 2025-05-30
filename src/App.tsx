import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ARKlinkoBlockchain from "@/pages/arklinko-blockchain";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Toaster />
          <ARKlinkoBlockchain />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
