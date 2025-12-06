/**
 * Auth Debug Page
 * Dedicated page for comprehensive auth debugging
 */

import React, { useEffect } from 'react';
import AuthDebugPanel from '@/components/AuthDebugPanel';
import { AuthDebugger } from '@/utils/authDebugger';

const AuthDebug: React.FC = () => {
  useEffect(() => {
    // Initialize debugger on page load
    AuthDebugger.captureAuthState('debug-page-load');
    
    // Add global access for console debugging
    (window as any).AuthDebugger = AuthDebugger;
    
    console.log('🔍 Auth Debug Page Loaded');
    console.log('💡 Use AuthDebugger in console for manual testing');
    console.log('📋 Available methods:');
    console.log('  - AuthDebugger.captureAuthState("context")');
    console.log('  - AuthDebugger.testAuthEndpoints()');
    console.log('  - AuthDebugger.testSignIn(email, password)');
    console.log('  - AuthDebugger.testSignOut()');
    console.log('  - AuthDebugger.exportLogs()');
    console.log('  - AuthDebugger.startMonitoring()');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-expos-dark via-expos-dark-elevated to-black">
      <div className="container mx-auto py-8">
        <AuthDebugPanel />
      </div>
    </div>
  );
};

export default AuthDebug;