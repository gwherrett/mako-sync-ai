import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SpotifySecurityDashboard } from '@/components/spotify/SpotifySecurityDashboard';
import { Phase4IntegrationTest } from '@/components/Phase4IntegrationTest';

const Security = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-expos-dark via-expos-dark-elevated to-black">
      {/* Header */}
      <div className="bg-expos-dark-elevated/50 border-b border-expos-blue/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-blue-500" />
                <div>
                  <h1 className="text-2xl font-bold text-white">Security Center</h1>
                  <p className="text-gray-400">Monitor and manage your Spotify connection security</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="dashboard">Security Dashboard</TabsTrigger>
            <TabsTrigger value="testing">Integration Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <SpotifySecurityDashboard />
          </TabsContent>

          <TabsContent value="testing">
            <Phase4IntegrationTest />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Security;