import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Monitor, Shield, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface BlocklistItem {
  id: number;
  app_or_url_name: string;
}

interface SettingsViewProps {
  blocklist: BlocklistItem[];
  onAdd: (name: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}

export default function SettingsView({ blocklist, onAdd, onRemove }: SettingsViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) { setError('Enter an app name or domain.'); return; }
    setAdding(true);
    setError('');
    try {
      await onAdd(trimmed);
      setInputValue('');
    } catch (err: any) {
      setError(err.message || 'Failed to add entry.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    try { await onRemove(id); } catch (err) { console.error('[Settings] Remove failed:', err); }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your blocklist and preferences</p>
      </div>

      {/* Blocklist */}
      <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-sm font-bold text-foreground mb-1">Blocklist</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Enter an app name (e.g. <span className="font-mono text-primary">Slack</span>) or domain (e.g. <span className="font-mono text-primary">reddit.com</span>).
        </p>

        <form onSubmit={handleAdd} className="flex gap-2 mb-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="reddit.com or Slack"
            disabled={adding}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={adding || !inputValue.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-semibold text-sm transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            {adding ? '…' : 'Add'}
          </button>
        </form>

        {error && <p className="text-xs text-destructive mb-2">{error}</p>}

        {/* Table */}
        {blocklist.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-3">Your blocklist is empty.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">App / Domain</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {blocklist.map((item, i) => (
                  <tr key={item.id} className={`border-t border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-3 py-2 text-sm font-mono text-primary">{item.app_or_url_name}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Remove ${item.app_or_url_name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Feature Toggles */}
      <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h2 className="text-sm font-bold text-foreground mb-4">Preferences</h2>
        <div className="flex flex-col gap-4">
          <ToggleRow
            icon={<Monitor className="w-4 h-4" />}
            label="Enable Webcam Posture Tracking"
            description="Use your webcam to detect poor posture (coming soon)"
          />
          <ToggleRow
            icon={<Shield className="w-4 h-4" />}
            label="Enable Strict Mode"
            description="Prevent stopping sessions early"
          />
          <ToggleRow
            icon={<Eye className="w-4 h-4" />}
            label="Eye Strain Reminders"
            description="Get notified to rest your eyes every 20 minutes"
          />
        </div>
      </motion.div>
    </div>
  );
}

function ToggleRow({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  const [enabled, setEnabled] = useState(false);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">{icon}</div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={setEnabled} />
    </div>
  );
}
