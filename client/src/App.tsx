import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AgentRegistry from "./pages/AgentRegistry";
import AgentDetail from "./pages/AgentDetail";
import Marketplace from "./pages/Marketplace";
import Docs from "./pages/Docs";
import Escrow from "./pages/Escrow";
import HowItWorks from "./pages/HowItWorks";
import Guide from "./pages/Guide";
import BarterMarket from "./pages/BarterMarket";
import Fleet from "./pages/Fleet";
import Leaderboard from "./pages/Leaderboard";
import AgentProfile from "./pages/AgentProfile";
import Login from "./pages/Login";
import ClawHubPublish from "./pages/ClawHubPublish";
import OnboardAgent from "./pages/OnboardAgent";
import AgentManage from "./pages/AgentManage";
import BulkOnboard from "./pages/BulkOnboard";
import ChallengeVerify from "./pages/ChallengeVerify";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/agents"} component={AgentRegistry} />
      <Route path={"/agents/:agentId"} component={AgentDetail} />
      <Route path={"/agent/:agentId"} component={AgentProfile} />
      <Route path={"/marketplace"} component={Marketplace} />
      <Route path={"/docs"} component={Docs} />
      <Route path={"/escrow"} component={Escrow} />
      <Route path={"/how-it-works"} component={HowItWorks} />
      <Route path={"/guide"} component={Guide} />
      <Route path={"/barter"} component={BarterMarket} />
      <Route path={"/fleet"} component={Fleet} />
      <Route path={"/leaderboard"} component={Leaderboard} />
      <Route path={"/clawhub"} component={ClawHubPublish} />
      <Route path={"/onboard"} component={OnboardAgent} />
      <Route path={"/bulk-onboard"} component={BulkOnboard} />
      <Route path={"/verify"} component={ChallengeVerify} />
      <Route path={"/manage/:agentId"} component={AgentManage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TonConnectUIProvider manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </TonConnectUIProvider>
    </ErrorBoundary>
  );
}

export default App;
