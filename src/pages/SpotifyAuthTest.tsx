import React from 'react';
import SpotifyAuthIntegrationTest from '@/components/SpotifyAuthIntegrationTest';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TestTube } from 'lucide-react';
import { Link } from 'react-router-dom';

const SpotifyAuthTest: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-expos-dark via-expos-dark-elevated to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  <TestTube className="w-8 h-8" />
                  Spotify Authentication Testing
                </h1>
                <p className="text-gray-400 mt-1">
                  Comprehensive validation of the unified Spotify authentication system
                </p>
              </div>
            </div>
          </div>

          {/* Warning Card */}
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Testing Environment
              </CardTitle>
              <CardDescription className="text-yellow-300/80">
                This page contains comprehensive tests for the unified Spotify authentication system. 
                Run these tests to validate that all authentication flows are working correctly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-yellow-200/90">
                <p>• Tests cover connection management, OAuth flow, token handling, and error scenarios</p>
                <p>• Some tests are mocked for safety and to avoid actual API calls during testing</p>
                <p>• Real authentication flows can be tested through the main application interface</p>
                <p>• Results will show detailed information about each test component</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Test Component */}
        <SpotifyAuthIntegrationTest />
      </div>
    </div>
  );
};

export default SpotifyAuthTest;