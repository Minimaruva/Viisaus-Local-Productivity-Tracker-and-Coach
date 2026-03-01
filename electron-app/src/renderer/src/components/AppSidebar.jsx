import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Calendar, Clock, Settings, Shield, FolderKanban } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', icon: BarChart3,   label: 'Dashboard' },
  { id: 'calendar',  icon: Calendar,    label: 'Calendar'  },
  { id: 'projects',  icon: FolderKanban, label: 'Projects' },
  { id: 'focus',     icon: Clock,       label: 'Focus'     },
  { id: 'settings',  icon: Settings,    label: 'Settings'  },
];

export default function AppSidebar({ activePanel, onPanelChange, isSessionActive }) {
  return (
    <nav className="flex flex-col w-16 bg-sidebar border-r border-sidebar-border items-center py-6 gap-2 shrink-0">
      {/* Brand */}
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
        <Shield className="w-5 h-5 text-primary" />
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
        const isActive = activePanel === id;
        return (
          <button
            key={id}
            onClick={() => onPanelChange(id)}
            className={`relative w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200 group ${
              isActive
                ? 'text-primary bg-sidebar-accent'
                : 'text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50'
            }`}
            title={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-[18px] h-[18px]" />
            {isActive && (
              <motion.div
                layoutId="sidebar-indicator"
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        );
      })}

      <div className="flex-1" />

      {isSessionActive && (
        <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse mb-3" title="Session active" />
      )}

      <span className="text-[9px] font-medium text-muted-foreground tracking-wider uppercase">Local</span>
    </nav>
  );
}
