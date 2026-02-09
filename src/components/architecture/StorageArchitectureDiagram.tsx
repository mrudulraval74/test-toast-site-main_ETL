import React from 'react';
import { Database, HardDrive, Image, FileImage, Trash2, ArrowRight, Clock, TrendingDown } from 'lucide-react';

interface StorageBlockProps {
  icon: React.ReactNode;
  title: string;
  size: string;
  items: string[];
  color: string;
}

const StorageBlock: React.FC<StorageBlockProps> = ({ icon, title, size, items, color }) => (
  <div className={`p-4 rounded-xl border-2 ${color}`}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-bold">{title}</span>
      </div>
      <span className="text-sm text-muted-foreground">{size}</span>
    </div>
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div key={idx} className="text-sm flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-current opacity-50" />
          {item}
        </div>
      ))}
    </div>
  </div>
);

export const StorageArchitectureDiagram: React.FC = () => {
  return (
    <div className="p-6">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Optimized Storage Architecture</h2>
        <p className="text-muted-foreground">Reduced Database Egress with Blob Storage Migration</p>
      </div>

      {/* Before/After Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Before */}
        <div className="p-4 rounded-xl border-2 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-4">
            <div className="px-2 py-1 rounded bg-red-500 text-white text-xs font-bold">BEFORE</div>
            <span className="text-lg font-bold text-red-600">Legacy Architecture</span>
          </div>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20 border border-red-300">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-red-500" />
                <span className="font-medium">PostgreSQL Database</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Screenshots as base64 in JSON columns</li>
                <li>• Visual baselines as base64 TEXT</li>
                <li>• ~1.08 GB/day egress</li>
              </ul>
            </div>
            <div className="text-center text-red-600 font-bold">
              ⚠️ High bandwidth costs
            </div>
          </div>
        </div>

        {/* After */}
        <div className="p-4 rounded-xl border-2 border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-2 mb-4">
            <div className="px-2 py-1 rounded bg-green-500 text-white text-xs font-bold">AFTER</div>
            <span className="text-lg font-bold text-green-600">Optimized Architecture</span>
          </div>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20 border border-green-300">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-4 w-4 text-green-500" />
                <span className="font-medium">Supabase Storage</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Screenshots in blob storage</li>
                <li>• Visual baselines in blob storage</li>
                <li>• ~100 MB/day egress</li>
              </ul>
            </div>
            <div className="text-center text-green-600 font-bold">
              ✓ 90% bandwidth reduction
            </div>
          </div>
        </div>
      </div>

      {/* Storage Buckets */}
      <h3 className="text-lg font-bold mb-4">Storage Buckets</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StorageBlock
          icon={<Image className="h-5 w-5 text-blue-500" />}
          title="test-screenshots"
          size="~500 MB/day"
          items={[
            'Execution screenshots',
            'Step-by-step captures',
            'Error state images',
            '7-day retention policy'
          ]}
          color="border-blue-500/30 bg-blue-500/5"
        />
        <StorageBlock
          icon={<FileImage className="h-5 w-5 text-purple-500" />}
          title="visual-baselines"
          size="~50 MB (stable)"
          items={[
            'Golden baseline images',
            'Mask configurations',
            'Version history',
            'Permanent retention'
          ]}
          color="border-purple-500/30 bg-purple-500/5"
        />
      </div>

      {/* Data Flow */}
      <h3 className="text-lg font-bold mb-4">Optimized Data Flow</h3>
      <div className="flex flex-col md:flex-row items-center gap-4 p-4 rounded-xl border bg-muted/30">
        <div className="flex-1 text-center p-4">
          <div className="text-3xl mb-2">🧪</div>
          <div className="font-medium">Test Execution</div>
          <div className="text-sm text-muted-foreground">Agent captures screenshots</div>
        </div>
        <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
        <div className="flex-1 text-center p-4">
          <div className="text-3xl mb-2">📤</div>
          <div className="font-medium">Direct Upload</div>
          <div className="text-sm text-muted-foreground">Binary → Supabase Storage</div>
        </div>
        <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
        <div className="flex-1 text-center p-4">
          <div className="text-3xl mb-2">🔗</div>
          <div className="font-medium">URL Reference</div>
          <div className="text-sm text-muted-foreground">Store path in PostgreSQL</div>
        </div>
        <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
        <div className="flex-1 text-center p-4">
          <div className="text-3xl mb-2">🖼️</div>
          <div className="font-medium">CDN Delivery</div>
          <div className="text-sm text-muted-foreground">Images served via CDN</div>
        </div>
      </div>

      {/* Retention & Cleanup */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <Clock className="h-6 w-6 text-amber-500 mt-1" />
          <div>
            <div className="font-bold">Automated Cleanup</div>
            <div className="text-sm text-muted-foreground">
              Daily cron job removes execution data older than 7 days.
              Baselines are preserved indefinitely for regression testing.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <TrendingDown className="h-6 w-6 text-emerald-500 mt-1" />
          <div>
            <div className="font-bold">Cost Savings</div>
            <div className="text-sm text-muted-foreground">
              Estimated 90% reduction in database egress costs.
              From ~1 GB/day to ~100 MB/day after full migration.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
