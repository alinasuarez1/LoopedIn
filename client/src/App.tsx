import { Switch, Route } from "wouter";
import { useUser } from "./hooks/use-user";
import { Loader2 } from "lucide-react";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import LoopManager from "./pages/LoopManager";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLoopDetails from "./pages/AdminLoopDetails";
import NewsletterEditor from "./pages/NewsletterEditor";
import ProfilePage from "./pages/ProfilePage";
import { Navbar } from "./components/Navbar";

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {!user ? (
          <Switch>
            <Route path="/auth" component={AuthPage} />
            <Route component={LandingPage} />
          </Switch>
        ) : (
          <Switch>
            <Route path="/profile" component={ProfilePage} />
            <Route path="/loops/:id" component={LoopManager} />
            {user.isPrivileged && (
              <>
                <Route path="/admin/loops/:id" component={AdminLoopDetails} />
                <Route path="/admin/loops/:loopId/newsletters/:newsletterId" component={NewsletterEditor} />
                <Route path="/admin" component={AdminDashboard} />
              </>
            )}
            <Route path="/" component={Dashboard} />
          </Switch>
        )}
      </main>
    </div>
  );
}

export default App;