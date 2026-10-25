import { useCallback, useEffect, useState } from 'react';

import { api, errorMessage } from '@/lib/api';

export interface Task {
  id: number;
  title: string;
  notes: string | null;
  /** ISO `yyyy-MM-dd`, matching the backend's LocalDate. */
  dueDate: string | null;
  completed: boolean;
}

export type TaskDraft = Omit<Task, 'id'>;

export const TITLE_MAX = 120;
export const NOTES_MAX = 2000;

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Task[]>('/api/tasks');
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your tasks.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (draft: TaskDraft) => {
    const { data } = await api.post<Task>('/api/tasks', draft);
    setTasks(current => [...current, data]);
    return data;
  }, []);

  const update = useCallback(async (task: Task) => {
    const { data } = await api.put<Task>(`/api/tasks/${task.id}`, task);
    setTasks(current => current.map(item => (item.id === data.id ? data : item)));
    return data;
  }, []);

  const toggle = useCallback(
    async (task: Task) => {
      const next = { ...task, completed: !task.completed };
      // Optimistic: ticking a box should feel instant.
      setTasks(current => current.map(item => (item.id === task.id ? next : item)));
      try {
        const { data } = await api.put<Task>(`/api/tasks/${task.id}`, next);
        setTasks(current => current.map(item => (item.id === data.id ? data : item)));
      } catch (err) {
        setTasks(current => current.map(item => (item.id === task.id ? task : item)));
        throw err;
      }
    },
    [],
  );

  const remove = useCallback(async (id: number) => {
    const snapshot = tasks;
    setTasks(current => current.filter(item => item.id !== id));
    try {
      await api.delete(`/api/tasks/${id}`);
    } catch (err) {
      setTasks(snapshot);
      throw err;
    }
  }, [tasks]);

  return { tasks, loading, error, reload: load, create, update, toggle, remove };
}

export type DueState = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Parses `yyyy-MM-dd` in local time; `new Date(string)` would read it as UTC and shift the day. */
export function parseDueDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function dueState(task: Task): DueState {
  const due = parseDueDate(task.dueDate);
  if (!due) {
    return 'none';
  }
  const diff = Math.round((due.getTime() - startOfToday().getTime()) / 86_400_000);
  if (diff < 0) {
    return 'overdue';
  }
  if (diff === 0) {
    return 'today';
  }
  if (diff === 1) {
    return 'tomorrow';
  }
  return 'upcoming';
}

export function formatDueDate(task: Task): string {
  const due = parseDueDate(task.dueDate);
  if (!due) {
    return '';
  }
  const state = dueState(task);
  if (state === 'today') {
    return 'Today';
  }
  if (state === 'tomorrow') {
    return 'Tomorrow';
  }

  const sameYear = due.getFullYear() === new Date().getFullYear();
  const label = due.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return state === 'overdue' ? `Overdue — ${label}` : label;
}

export function todayAsISO(): string {
  const now = startOfToday();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
