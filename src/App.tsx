
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NewAuthProvider } from "@/contexts/NewAuthContext";
import { useAuthState } from "./hooks/useAuthState";
import { SessionTimeoutWarning } from "./components/auth/SessionTimeoutWarning";
import { AuthLoadingOverlay } from "./components/auth/AuthLoadingStates";
import NewProtectedRoute from "@/components/NewProtectedRoute";
import Index from "./pages/Index";
import NewAuth from "./pages/NewAuth";
import ResetPassword from "./pages/ResetPassword";
import SpotifyCallback from "./pages/SpotifyCallback";
import NotFound from "./pages/NotFound";
import { GenreMapping } from "./pages/GenreMapping";
import { TrackLevelProcessor } from "./components/NoGenreTracks/TrackLevelProcessor";
import Security from "./pages/Security";

const queryClient = new QueryClient();

// App content component that uses auth state
function AppContent() {
  const authState = useAuthState({
    showLoadingStates: true,
    sessionTimeoutWarning: 5, // 5 minutes warning
    autoRefresh: true,
  });

  return (
    <>
      {/* Global loading overlay for initialization */}
      <AuthLoadingOverlay
        isInitializing={authState.isInitializing}
        isRefreshing={authState.isRefreshing}
        isOnline={authState.isOnline}
      />

      {/* Session timeout warning */}
      <SessionTimeoutWarning
        timeRemaining={authState.sessionTimeRemaining || 0}
        isRefreshing={authState.isRefreshing}
        isOnline={authState.isOnline}
        onExtendSession={authState.extendSession}
      />

      {/* Main application routes */}
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<NewAuth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/spotify-callback" element={<SpotifyCallback />} />
          <Route path="/" element={
            <NewProtectedRoute>
              <Index />
            </NewProtectedRoute>
          } />
          <Route path="/genre-mapping" element={
            <NewProtectedRoute>
              <GenreMapping />
            </NewProtectedRoute>
          } />
          <Route path="/no-genre-tracks" element={
            <NewProtectedRoute>
              <TrackLevelProcessor />
            </NewProtectedRoute>
          } />
          <Route path="/security" element={
            <NewProtectedRoute>
              <Security />
            </NewProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <NewAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </NewAuthProvider>
  </QueryClientProvider>
);

export default App;
