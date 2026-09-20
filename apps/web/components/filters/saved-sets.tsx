'use client';

import { BookmarkPlus, Trash2 } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource } from '@/components/use-resource';
import { ApiError, type SavedFilter, apiSend } from '@/lib/api';
import { type FilterState, parseFilters, toQueryString } from '@/lib/filters';

import { Chip } from './chip';

/**
 * Saved filter sets, above the chips where the spec puts them.
 *
 * The spec's own words are "you will use three of these forever and never open the drawer
 * again", so the common path is one tap on a name and nothing else. Saving and deleting
 * live behind one more control, because they happen three times and then never again, and
 * a manager of dozens would cost the screen more room than the sets themselves.
 *
 * A set is a query string with a name on it, which is what makes this work at all: filter
 * state is already in the URL, so there is nothing to serialise and nothing to keep in
 * step. What comes back from the API is put through `parseFilters` before it is applied,
 * so a set saved before a parameter changed cannot put a value on screen that the current
 * filters cannot show.
 */
export function SavedSets({
  currentQuery,
  apply,
}: {
  currentQuery: string;
  apply: (next: FilterState) => void;
}): ReactNode {
  const { state, reload } = useResource<SavedFilter[]>('/api/saved-filters');
  const panelId = useId();
  const nameId = useId();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sets = state.status === 'ready' ? state.data : [];

  async function save(): Promise<void> {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Give the set a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiSend<SavedFilter>('/api/saved-filters', 'POST', {
        name: trimmed,
        query: currentQuery,
      });
      setName('');
      setOpen(false);
      reload();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'name_taken') {
        setError('That name is taken.');
      } else if (cause instanceof ApiError && cause.kind !== 'unauthorized') {
        setError(cause.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await apiSend<void>(`/api/saved-filters/${id}`, 'DELETE');
      reload();
    } catch (cause) {
      if (cause instanceof ApiError && cause.kind !== 'unauthorized') setError(cause.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {/* h4, because this sits inside the massif sheet's "Trails" section. */}
        <h4 className="sr-only">Saved filter sets</h4>

        {state.status === 'loading' && <Skeleton className="h-12 w-32" />}

        {sets.map((set) => {
          const query = toQueryString(parseFilters(new URLSearchParams(set.query)));
          return (
            <Chip
              key={set.id}
              pressed={query === currentQuery}
              onClick={() => apply(parseFilters(new URLSearchParams(set.query)))}
            >
              {set.name}
            </Chip>
          );
        })}

        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
            setError(null);
          }}
          className="w-auto px-4"
        >
          <BookmarkPlus aria-hidden strokeWidth={1.75} />
          Save
        </Button>
      </div>

      {/*
        The failure of this one read is deliberately quiet. Saved sets are a shortcut to a
        filter set the reader can still build by hand, so a panel of error furniture above
        the chips would cost more than the sets are worth when the network drops.
      */}
      {state.status === 'failed' && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Saved sets did not load. The filters below still work.
        </p>
      )}

      {open && (
        <div id={panelId} className="mt-3 rounded-md border p-4">
          <Label htmlFor={nameId}>Name this set</Label>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            It stores the filters you have on now, as a link.
          </p>
          <Input
            id={nameId}
            value={name}
            maxLength={100}
            autoComplete="off"
            aria-invalid={error !== null}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            className="mt-2"
          />
          {error !== null && (
            <p role="alert" className="mt-2 text-sm leading-6 text-destructive">
              {error}
            </p>
          )}
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="mt-3 w-auto px-6"
          >
            {saving ? 'Saving' : 'Save this set'}
          </Button>

          {sets.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <h5 className="font-medium">Sets you have</h5>
              <ul className="mt-1 divide-y">
                {sets.map((set) => (
                  <li key={set.id} className="flex min-h-14 items-center gap-3">
                    <span className="min-w-0 flex-1 truncate">{set.name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId === set.id}
                      onClick={() => void remove(set.id)}
                      className="w-auto shrink-0 px-4"
                    >
                      <Trash2 aria-hidden strokeWidth={1.75} />
                      <span className="sr-only">Delete the set named {set.name}</span>
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
