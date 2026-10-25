import { useMemo, useState, type FormEvent } from 'react';

import { InboxIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { ConfirmDeleteDialog, TaskDialog } from '@/components/TaskDialog';
import { TaskRow } from '@/components/TaskRow';
import { Banner, Button, cx } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth';
import { dueState, TITLE_MAX, useTasks, type Task, type TaskDraft } from '@/lib/tasks';
import { useToast } from '@/lib/toast';

type Filter = 'all' | 'active' | 'completed';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
];

export default function TasksPage() {
  const { account } = useAuth();
  const { notify } = useToast();
  const { tasks, loading, error, reload, create, update, toggle, remove } = useTasks();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      active: tasks.filter(task => !task.completed).length,
      completed: tasks.filter(task => task.completed).length,
    }),
    [tasks],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return tasks
      .filter(task => {
        if (filter === 'active' && task.completed) return false;
        if (filter === 'completed' && !task.completed) return false;
        if (!needle) return true;
        return (
          task.title.toLowerCase().includes(needle) || (task.notes ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        // Open work first, then soonest due, then newest.
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return b.id - a.id;
      });
  }, [tasks, filter, query]);

  const overdue = useMemo(
    () => tasks.filter(task => !task.completed && dueState(task) === 'overdue').length,
    [tasks],
  );

  async function onQuickAdd(event: FormEvent) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) {
      return;
    }
    setAdding(true);
    try {
      await create({ title: title.slice(0, TITLE_MAX), notes: null, dueDate: null, completed: false });
      setQuickTitle('');
    } catch (err) {
      notify(errorMessage(err, 'Could not add that task.'), 'error');
    } finally {
      setAdding(false);
    }
  }

  async function onSave(draft: TaskDraft) {
    if (editing) {
      await update({ ...editing, ...draft });
      notify('Task updated.');
    } else {
      await create(draft);
      notify('Task added.');
    }
  }

  const greeting = account ? displayName(account).split(' ')[0] : '';

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting ? `Hello, ${greeting}` : 'Your tasks'}
        </h1>
        <p className="text-sm text-muted">
          {loading
            ? 'Loading your tasks…'
            : counts.active === 0 && counts.all > 0
              ? 'Everything is done. Enjoy the quiet.'
              : counts.all === 0
                ? 'Nothing here yet — add your first task below.'
                : `${counts.active} open${overdue > 0 ? ` · ${overdue} overdue` : ''}`}
        </p>
      </header>

      <form onSubmit={onQuickAdd} className="flex gap-2">
        <div className="relative flex-1">
          <PlusIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={quickTitle}
            onChange={event => setQuickTitle(event.target.value)}
            maxLength={TITLE_MAX}
            aria-label="New task title"
            placeholder="Add a task and press Enter…"
            className="h-11 w-full rounded-xl2 border border-[var(--border-strong)] bg-[var(--surface-card)] pr-3 pl-9 text-sm shadow-xs transition-colors hover:border-brand-400 focus:border-brand-500"
          />
        </div>
        <Button type="submit" loading={adding} disabled={!quickTitle.trim()} className="h-11 px-4">
          Add
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-11 px-3"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          title="Add with notes and a due date"
        >
          Details
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-[var(--surface-sunken)] p-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cx(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === key
                  ? 'bg-[var(--surface-card)] text-[var(--text-strong)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]',
              )}
            >
              {label}
              <span className="ml-1.5 text-xs text-faint">{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="Search tasks"
            placeholder="Search"
            className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] pr-3 pl-9 text-sm transition-colors hover:border-brand-400 focus:border-brand-500"
          />
        </div>
      </div>

      {error && (
        <Banner tone="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <button onClick={() => void reload()} className="font-medium underline">
              Retry
            </button>
          </div>
        </Banner>
      )}

      {loading ? (
        <TaskSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState hasTasks={counts.all > 0} query={query} filter={filter} />
      ) : (
        <ul className="surface-card divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl2">
          {visible.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={async item => {
                try {
                  await toggle(item);
                } catch (err) {
                  notify(errorMessage(err, 'Could not update that task.'), 'error');
                }
              }}
              onEdit={item => {
                setEditing(item);
                setDialogOpen(true);
              }}
              onDelete={setPendingDelete}
            />
          ))}
        </ul>
      )}

      <TaskDialog
        open={dialogOpen}
        task={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSave={onSave}
      />

      <ConfirmDeleteDialog
        task={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await remove(pendingDelete.id);
            notify('Task deleted.');
          } catch (err) {
            notify(errorMessage(err, 'Could not delete that task.'), 'error');
          } finally {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
}

function TaskSkeleton() {
  return (
    <ul className="surface-card divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl2" aria-hidden="true">
      {[0, 1, 2].map(row => (
        <li key={row} className="flex items-center gap-3 px-4 py-4">
          <span className="size-5 shrink-0 animate-pulse rounded-full bg-[var(--surface-hover)]" />
          <span
            className="h-3.5 animate-pulse rounded bg-[var(--surface-hover)]"
            style={{ width: `${60 - row * 12}%` }}
          />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ hasTasks, query, filter }: { hasTasks: boolean; query: string; filter: Filter }) {
  const message = query.trim()
    ? { title: 'No matches', body: `Nothing matches “${query.trim()}”.` }
    : filter === 'completed'
      ? { title: 'Nothing finished yet', body: 'Completed tasks will collect here.' }
      : filter === 'active' && hasTasks
        ? { title: 'All clear', body: 'Every task is done.' }
        : { title: 'No tasks yet', body: 'Add your first one using the box above.' };

  return (
    <div className="surface-card flex flex-col items-center rounded-xl2 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-faint)]">
        <InboxIcon className="size-6" />
      </span>
      <h2 className="mt-4 text-sm font-semibold">{message.title}</h2>
      <p className="mt-1 max-w-xs text-sm text-muted">{message.body}</p>
    </div>
  );
}
