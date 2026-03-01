/**
 * Project model + constants.
 *
 * A Project is a plain JS object (no TypeScript):
 * {
 *   id: string,
 *   name: string,
 *   color: string,       // HSL value e.g. "199 89% 56%"
 *   icon: string,        // emoji
 *   description: string,
 *   autostartApps: string[],
 *   musicPlaylist: string | undefined,
 *   strictMode: boolean,
 *   defaultFocusDuration: number  (minutes)
 *   defaultBreakDuration: number  (minutes)
 *   createdAt: string,
 * }
 */

export const PROJECT_COLORS = [
  { label: 'Cyan',   value: '199 89% 56%' },
  { label: 'Purple', value: '232 65% 68%' },
  { label: 'Green',  value: '142 71% 45%' },
  { label: 'Orange', value: '38 92% 50%'  },
  { label: 'Rose',   value: '346 77% 60%' },
  { label: 'Blue',   value: '217 91% 60%' },
  { label: 'Amber',  value: '45 93% 47%'  },
  { label: 'Teal',   value: '172 66% 50%' },
];

export const PROJECT_ICONS = [
  '📚', '💻', '🎨', '📖', '🧪', '🎓', '💼', '🏋️', '🎵', '📝', '🔬', '🚀',
];
