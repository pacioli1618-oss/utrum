'use client';

import {useId, type ComponentProps} from 'react';
import styles from './TextField.module.css';

type TextAreaFieldProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  label: string;
  hint?: string;
  error?: string | null;
};

/** Multi-line TextField: items pasted from a note or a chat. */
export function TextAreaField({label, hint, error, className, rows = 3, ...rest}: TextAreaFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className={`${styles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...rest}
      />
      {hint && !error && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
