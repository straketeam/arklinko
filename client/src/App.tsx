import { Route, Switch } from "wouter"
import ARKlinkoBlockchain from "./pages/arklinko-blockchain-fixed"

function App() {
  return (
    <Switch>
      <Route path="/" component={ARKlinkoBlockchain} />
      <Route path="/game" component={ARKlinkoBlockchain} />
      <Route>
        <ARKlinkoBlockchain />
      </Route>
    </Switch>
  )
}

export default App
