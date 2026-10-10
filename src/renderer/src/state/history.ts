import { useSyncExternalStore } from 'react';

/**
 * Undo/redo over immutable snapshots. fSpy has no undo at all; here every
 * edit is undoable from day one.
 *
 * Drags are "gestures": the many intermediate states of one drag collapse
 * into a single undo step (begin → update… → end).
 */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private gestureBase: T | null = null;
  private listeners = new Set<() => void>();
  private savedAt: T;
  /** Bumped on every change, including ones that keep the same value (save, gestures). */
  revision = 0;

  constructor(private present: T, private readonly limit = 300) {
    this.savedAt = present;
  }

  get value(): T {
    return this.present;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get dirty(): boolean {
    return this.present !== this.savedAt;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Apply an edit. Outside a gesture it becomes its own undo step. */
  update(edit: (value: T) => T): void {
    const next = edit(this.present);
    if (next === this.present) return;
    if (this.gestureBase === null) this.push(this.present);
    this.present = next;
    this.emit();
  }

  beginGesture(): void {
    this.gestureBase = this.present;
  }

  endGesture(): void {
    if (this.gestureBase !== null && this.gestureBase !== this.present) this.push(this.gestureBase);
    this.gestureBase = null;
    this.emit();
  }

  undo(): void {
    const prev = this.past.pop();
    if (prev === undefined) return;
    this.future.push(this.present);
    this.present = prev;
    this.emit();
  }

  redo(): void {
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(this.present);
    this.present = next;
    this.emit();
  }

  /** Replace everything (opening a file). Not undoable. */
  reset(value: T): void {
    this.past = [];
    this.future = [];
    this.present = value;
    this.savedAt = value;
    this.emit();
  }

  markSaved(): void {
    this.savedAt = this.present;
    this.emit();
  }

  private push(value: T): void {
    this.past.push(value);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  private emit(): void {
    this.revision++;
    for (const l of this.listeners) l();
  }
}

/** Subscribe a component to the history; re-renders on any change, including undo-state and saved-state. */
export function useHistory<T>(history: History<T>): T {
  useSyncExternalStore(history.subscribe, () => history.revision);
  return history.value;
}
