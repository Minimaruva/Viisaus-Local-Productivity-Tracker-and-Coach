import { useState, useEffect, useCallback } from 'react';

/**
 * useProjects — load/add/update/remove projects via IPC (or in-memory fallback).
 */
export function useProjects() {
  const [projects, setProjects] = useState([]);

  const load = useCallback(async () => {
    if (!window.electronAPI) {
      // Fallback demo data for plain browser / dev preview
      setProjects([
        {
          id: 'demo-1',
          name: 'University',
          color: '232 65% 68%',
          icon: '🎓',
          description: 'CS coursework',
          autostartApps: ['VS Code', 'Chrome'],
          musicPlaylist: '',
          strictMode: true,
          defaultFocusDuration: 45,
          defaultBreakDuration: 10,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'demo-2',
          name: 'Side Project',
          color: '199 89% 56%',
          icon: '💻',
          description: 'My productivity app',
          autostartApps: ['VS Code', 'Terminal'],
          musicPlaylist: '',
          strictMode: false,
          defaultFocusDuration: 25,
          defaultBreakDuration: 5,
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }
    try {
      const result = await window.electronAPI.invoke('projects:get');
      setProjects(result || []);
    } catch {
      // IPC not wired — that's fine, stay with empty list
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addProject = useCallback(async (project) => {
    setProjects((prev) => [...prev, project]);
    if (window.electronAPI) {
      window.electronAPI.invoke('projects:add', project).catch(() => {});
    }
  }, []);

  const updateProject = useCallback(async (project) => {
    setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
    if (window.electronAPI) {
      window.electronAPI.invoke('projects:update', project).catch(() => {});
    }
  }, []);

  const removeProject = useCallback(async (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (window.electronAPI) {
      window.electronAPI.invoke('projects:remove', id).catch(() => {});
    }
  }, []);

  return { projects, addProject, updateProject, removeProject };
}
