import { useEffect, useState, type FormEvent } from 'react';

import { Banner, Button, Input, Modal, Textarea } from '@/components/ui';
import { NOTES_MAX, TITLE_MAX, type Task, type TaskDraft } from '@/lib/tasks';

interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (draft: TaskDraft) => Promise<void>;
}

export function TaskDialog({ open, task, onClose, onSave }: TaskDialogProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Refill the form whenever a different task is opened.
  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    setDueDate(task?.dueDate ?? '');
    setTitleError(null);
    setFormError(null);
    setSaving(false);
  }, [open, task]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('A task needs a title.');
      return;
    }
    if (trimmed.length > TITLE_MAX) {
      setTitleError(`Keep the title under ${TITLE_MAX} characters.`);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        title: trimmed,
        notes: notes.trim() || null,
        dueDate: dueDate || null,
        completed: task?.completed ?? false,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the task.');
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      description={task ? undefined : 'Add something you want to come back to.'}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Banner tone="error">{formError}</Banner>}

        <Input
          label="Title"
          name="title"
          autoFocus
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={event => {
            setTitle(event.target.value);
            setTitleError(null);
          }}
          error={titleError}
          hint={`${title.length}/${TITLE_MAX}`}
        />

        <Textarea
          label="Notes"
          name="notes"
          rows={4}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={event => setNotes(event.target.value)}
          placeholder="Optional detail…"
          hint={notes.length > 0 ? `${notes.length}/${NOTES_MAX}` : 'Optional'}
        />

        <Input
          label="Due date"
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={event => setDueDate(event.target.value)}
          hint={
            dueDate ? (
              <button type="button" onClick={() => setDueDate('')} className="hover:underline">
                Clear
              </button>
            ) : (
              'Optional'
            )
          }
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {task ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface ConfirmDeleteProps {
  task: Task | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({ task, onCancel, onConfirm }: ConfirmDeleteProps) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (task) {
      setDeleting(false);
    }
  }, [task]);

  return (
    <Modal
      open={Boolean(task)}
      onClose={onCancel}
      title="Delete task?"
      description="This cannot be undone."
    >
      <p className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-sm break-words">{task?.title}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={deleting}>
          Keep it
        </Button>
        <Button
          variant="danger"
          loading={deleting}
          onClick={async () => {
            setDeleting(true);
            try {
              await onConfirm();
            } finally {
              setDeleting(false);
            }
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
