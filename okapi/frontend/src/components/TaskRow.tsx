import { CalendarIcon, CheckIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { cx } from '@/components/ui';
import { dueState, formatDueDate, type Task } from '@/lib/tasks';

const DUE_TONES: Record<string, string> = {
  overdue: 'text-red-600 dark:text-red-400',
  today: 'text-amber-600 dark:text-amber-400',
  tomorrow: 'text-[var(--text-muted)]',
  upcoming: 'text-[var(--text-muted)]',
};

interface TaskRowProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskRow({ task, onToggle, onEdit, onDelete }: TaskRowProps) {
  const state = dueState(task);
  const due = formatDueDate(task);

  return (
    <li className="group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]">
      <button
        onClick={() => onToggle(task)}
        role="checkbox"
        aria-checked={task.completed}
        aria-label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className={cx(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-all duration-150',
          task.completed
            ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500 dark:text-brand-950'
            : 'border-[var(--border-strong)] hover:border-brand-500 hover:bg-brand-500/10',
        )}
      >
        <CheckIcon className={cx('size-3 transition-opacity', task.completed ? 'opacity-100' : 'opacity-0')} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cx(
            'text-sm leading-snug break-words transition-colors',
            task.completed ? 'text-faint line-through' : 'text-[var(--text-strong)]',
          )}
        >
          {task.title}
        </p>

        {task.notes && (
          <p className={cx('mt-1 text-xs leading-relaxed break-words whitespace-pre-wrap text-muted', task.completed && 'opacity-60')}>
            {task.notes}
          </p>
        )}

        {due && (
          <p
            className={cx(
              'mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium',
              task.completed ? 'text-faint' : (DUE_TONES[state] ?? 'text-[var(--text-muted)]'),
            )}
          >
            <CalendarIcon className="size-3.5" />
            {due}
          </p>
        )}
      </div>

      {/* Always present for keyboard and touch; visually settles in on hover. */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
        <button
          onClick={() => onEdit(task)}
          aria-label={`Edit "${task.title}"`}
          className="grid size-8 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-card)] hover:text-[var(--text-strong)]"
        >
          <PencilIcon className="size-4" />
        </button>
        <button
          onClick={() => onDelete(task)}
          aria-label={`Delete "${task.title}"`}
          className="grid size-8 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
    </li>
  );
}
