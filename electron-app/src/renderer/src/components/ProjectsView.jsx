import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, X, AppWindow, Music, Shield,
  Clock, ChevronRight, FolderOpen, Settings2,
} from 'lucide-react';
import { PROJECT_COLORS, PROJECT_ICONS } from '@/types/project.js';

export default function ProjectsView({ projects, onAdd, onUpdate, onRemove, onSelectForFocus }) {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💻');
  const [color, setColor] = useState(PROJECT_COLORS[0].value);
  const [description, setDescription] = useState('');
  const [autostartApps, setAutostartApps] = useState('');
  const [musicPlaylist, setMusicPlaylist] = useState('');
  const [strictMode, setStrictMode] = useState(false);
  const [defaultFocus, setDefaultFocus] = useState(25);
  const [defaultBreak, setDefaultBreak] = useState(5);

  const resetForm = () => {
    setName(''); setIcon('💻'); setColor(PROJECT_COLORS[0].value);
    setDescription(''); setAutostartApps(''); setMusicPlaylist('');
    setStrictMode(false); setDefaultFocus(25); setDefaultBreak(5);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    onAdd({
      id: `proj-${Date.now()}`,
      name: name.trim(),
      color,
      icon,
      description: description.trim(),
      autostartApps: autostartApps.split(',').map((s) => s.trim()).filter(Boolean),
      musicPlaylist: musicPlaylist.trim() || undefined,
      strictMode,
      defaultFocusDuration: defaultFocus,
      defaultBreakDuration: defaultBreak,
      createdAt: new Date().toISOString(),
    });
    resetForm();
    setShowCreate(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Projects</h1>
          <p className="text-xs text-muted-foreground">Organize your focus by project</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="glass-card p-4 space-y-3">
              <div className="flex gap-2">
                <div className="flex gap-1 flex-wrap max-w-[100px]">
                  {PROJECT_ICONS.slice(0, 6).map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setIcon(ic)}
                      className={`w-7 h-7 rounded text-sm flex items-center justify-center transition-colors ${
                        icon === ic ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-muted'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Project name…"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Color</label>
                <div className="flex gap-1.5">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className={`w-6 h-6 rounded-full transition-all ${color === c.value ? 'ring-2 ring-offset-2 ring-offset-background' : ''}`}
                      style={{ backgroundColor: `hsl(${c.value})` }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Config */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <AppWindow className="w-3 h-3" /> Auto-start Apps
                  </label>
                  <input
                    value={autostartApps}
                    onChange={(e) => setAutostartApps(e.target.value)}
                    placeholder="VS Code, Chrome…"
                    className="w-full bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Music className="w-3 h-3" /> Music / Playlist
                  </label>
                  <input
                    value={musicPlaylist}
                    onChange={(e) => setMusicPlaylist(e.target.value)}
                    placeholder="lofi-beats…"
                    className="w-full bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-semibold text-muted-foreground">Focus:</label>
                  <select value={defaultFocus} onChange={(e) => setDefaultFocus(Number(e.target.value))} className="bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground outline-none">
                    {[15, 25, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}m</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-semibold text-muted-foreground">Break:</label>
                  <select value={defaultBreak} onChange={(e) => setDefaultBreak(Number(e.target.value))} className="bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground outline-none">
                    {[5, 10, 15, 20].map((m) => <option key={m} value={m}>{m}m</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                  <input type="checkbox" checked={strictMode} onChange={(e) => setStrictMode(e.target.checked)} className="accent-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-0.5">
                    <Shield className="w-3 h-3" /> Strict
                  </span>
                </label>
              </div>

              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 transition-all disabled:opacity-40"
              >
                Create Project
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {projects.length === 0 && !showCreate && (
          <div className="text-center py-12">
            <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No projects yet</p>
            <p className="text-xs text-muted-foreground/60">Create one to organize your focus sessions</p>
          </div>
        )}

        {projects.map((project) => {
          const isExpanded = expandedId === project.id;
          return (
            <motion.div key={project.id} layout className="glass-card overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : project.id)}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: `hsl(${project.color} / 0.15)` }}
                >
                  {project.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{project.name}</div>
                  {project.description && (
                    <div className="text-[11px] text-muted-foreground truncate">{project.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-mono text-muted-foreground">{project.defaultFocusDuration}m</span>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(${project.color})` }} />
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 pt-1 border-t border-border/30 space-y-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {project.autostartApps?.length > 0 && project.autostartApps.map((app) => (
                          <span key={app} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                            <AppWindow className="w-3 h-3" /> {app}
                          </span>
                        ))}
                        {project.musicPlaylist && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                            <Music className="w-3 h-3" /> {project.musicPlaylist}
                          </span>
                        )}
                        {project.strictMode && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                            <Shield className="w-3 h-3" /> Strict Mode
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                          <Clock className="w-3 h-3" /> {project.defaultFocusDuration}m / {project.defaultBreakDuration}m
                        </span>
                      </div>

                      {/* Coming-soon placeholder */}
                      <div className="rounded-lg bg-muted/50 border border-border/50 p-2.5 text-[10px] text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
                          <Settings2 className="w-3 h-3" /> Coming Soon
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 ml-1">
                          <li>Auto-launch configured apps on session start</li>
                          <li>Background music / ambient sounds</li>
                          <li>Project-specific blocklists</li>
                          <li>Focus time analytics per project</li>
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectForFocus?.(project); }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: `hsl(${project.color} / 0.15)`,
                            color: `hsl(${project.color})`,
                            border: `1px solid hsl(${project.color} / 0.3)`,
                          }}
                        >
                          <Clock className="w-3.5 h-3.5" /> Focus on this
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemove(project.id); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
