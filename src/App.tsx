
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NewAuthProvider } from "@/contexts/NewAuthContext";
import NewProtectedRoute from "@/components/NewProtectedRoute";
import Index from "./pages/Index";
import NewAuth from "./pages/NewAuth";
import SpotifyCallback from "./pages/SpotifyCallback";
import NotFound from "./pages/NotFound";
import { GenreMapping } from "./pages/GenreMapping";
import { ArtistGroupedProcessor } from "./components/NoGenreTracks/ArtistGroupedProcessor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <NewAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<NewAuth />} />
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
                <ArtistGroupedProcessor />
              </NewProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </NewAuthProvider>
  </QueryClientProvider>
);

export default App;
