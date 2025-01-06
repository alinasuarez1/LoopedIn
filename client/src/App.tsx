import { Switch, Route } from "wouter";
import { useUser } from "./hooks/use-user";
import { Loader2 } from "lucide-react";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import LoopManager from "./pages/LoopManager";

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/loops/:id" component={LoopManager} />
      <Route path="/" component={Dashboard} />
    </Switch>
  );
}

export default App;
