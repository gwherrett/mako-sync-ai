import { useState } from 'react';
import { ArrowLeft, Eye, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GenreMappingTable } from '@/components/GenreMapping/GenreMappingTable';
import { AuditMode } from '@/components/GenreMapping/AuditMode';
import { useGenreMapping } from '@/hooks/useGenreMapping';
import { Link } from 'react-router-dom';
export const GenreMapping = () => {
  const [activeTab, setActiveTab] = useState<'table' | 'audit'>('table');
  const {
    mappings,
    isLoading,
    error,
    setOverride,
    removeOverride,
    setBulkOverrides,
    exportToCSV
  } = useGenreMapping();
  if (error) {
    return <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error Loading Genre Mappings</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button asChild>
            <Link to="/">Return Home</Link>
          </Button>
        </div>
      </div>;
  }
  return <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Genre Map</h1>
            <p className="text-muted-foreground">Map Spotify Genres to DJ approved Super-Genres</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as 'table' | 'audit')}>
        <TabsList>
          <TabsTrigger value="table" className="flex items-center gap-2">
            <Table className="w-4 h-4" />
            Mapping Table
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Audit Mode
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="space-y-6">
          <GenreMappingTable mappings={mappings} onSetOverride={setOverride} onRemoveOverride={removeOverride} onExport={exportToCSV} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <AuditMode mappings={mappings} onSetOverride={setOverride} onRemoveOverride={removeOverride} onExit={() => setActiveTab('table')} />
        </TabsContent>
      </Tabs>
    </div>;
};