/**
 * SlskdConfigSection Component
 *
 * Configuration UI for connecting to a slskd instance.
 * Allows users to enter their slskd API endpoint and key,
 * test the connection, and save the configuration.
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSlskdConfig } from '@/hooks/useSlskdConfig';
import { Loader2, Server, CheckCircle2, XCircle } from 'lucide-react';

export function SlskdConfigSection() {
  const {
    config,
    isLoading,
    saveConfig,
    isSaving,
    testConnection,
    isTesting,
  } = useSlskdConfig();

  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');

  // Sync local state with loaded config
  useEffect(() => {
    if (config) {
      setApiEndpoint(config.apiEndpoint || '');
      setApiKey(config.apiKey || '');
    }
  }, [config]);

  const handleSave = () => {
    saveConfig({ apiEndpoint, apiKey });
  };

  const handleTest = () => {
    testConnection({ apiEndpoint, apiKey });
  };

  const hasChanges =
    config &&
    (apiEndpoint !== config.apiEndpoint || apiKey !== config.apiKey);

  const canSave = apiEndpoint.trim() && apiKey.trim();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            slskd Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading configuration...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>slskd Integration</CardTitle>
              <CardDescription>
                Connect to your slskd instance to push missing tracks to
                wishlist
              </CardDescription>
            </div>
          </div>
          {config?.connectionStatus ? (
            <Badge
              variant="default"
              className="bg-green-500 hover:bg-green-600"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : config?.apiEndpoint ? (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Disconnected
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slskd-endpoint">API Endpoint</Label>
          <Input
            id="slskd-endpoint"
            type="url"
            placeholder="http://localhost:5030"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            The URL of your slskd instance (e.g., http://localhost:5030)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slskd-api-key">API Key</Label>
          <Input
            id="slskd-api-key"
            type="password"
            placeholder="Your slskd API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Found in slskd Settings → Options → Web → API keys. Enable
            auto-download in slskd for best results.
          </p>
        </div>

        {config?.lastConnectionTest && (
          <p className="text-xs text-muted-foreground">
            Last tested:{' '}
            {new Date(config.lastConnectionTest).toLocaleString()}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !canSave}
          >
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !canSave}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </div>

        {hasChanges && (
          <p className="text-xs text-amber-600">
            You have unsaved changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
