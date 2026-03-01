import { useState, useEffect, useCallback } from 'react';
import { Project } from '@/types/project';

// In-memory state with IPC persistence (falls back to React state in web preview)
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!(window as any).electronAPI) {
      // Web preview: use demo projects
      setProjects([
        {
          id: 'demo-1',
          name: 'University — CS Module',
          color: '232 65% 68%',
          icon: '🎓',
          description: 'Computer Science coursework and lectures',
          autostartApps: ['VS Code', 'Chrome'],
          musicPlaylist: 'lofi-study',
          strictMode: true,
          defaultFocusDuration: 45,
          defaultBreakDuration: 10,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'demo-2',
          name: 'Side Project — App',
          color: '199 89% 56%',
          icon: '💻',
          description: 'Building my productivity app',
          autostartApps: ['VS Code', 'Terminal', 'Figma'],
          musicPlaylist: '',
          strictMode: false,
          defaultFocusDuration: 25,
          defaultBreakDuration: 5,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'demo-3',
          name: 'Reading — Design Books',
          color: '38 92% 50%',
          icon: '📖',
          description: '',
          autostartApps: [],
          musicPlaylist: 'ambient-reading',
          strictMode: false,
          defaultFocusDuration: 30,
          defaultBreakDuration: 5,
          createdAt: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.invoke('projects:get');
      setProjects(result || []);
    } catch {
      // IPC not wired yet — that's fine
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addProject = useCallback(async (project: Project) => {
    setProjects(prev => [...prev, project]);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.invoke('projects:add', project).catch(() => {});
    }
  }, []);

  const updateProject = useCallback(async (project: Project) => {
    setProjects(prev => prev.map(p => p.id === project.id ? project : p));
    if ((window as any).electronAPI) {
      (window as any).electronAPI.invoke('projects:update', project).catch(() => {});
    }
  }, []);

  const removeProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if ((window as any).electronAPI) {
      (window as any).electronAPI.invoke('projects:remove', id).catch(() => {});
    }
  }, []);

  return { projects, loading, addProject, updateProject, removeProject, reload: load };
}
