'use client';

import {useTranslations} from 'next-intl';
import {TextField} from '@/components/ui/TextField';
import styles from './CriterionField.module.css';

const presetKeys = ['important', 'urgent', 'critical', 'impact', 'prefer', 'watch', 'first'] as const;

type CriterionFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
};

/** The question asked on every comparison: pick a ready one or write your own. */
export function CriterionField({value, onChange, error}: CriterionFieldProps) {
  const t = useTranslations('Criterion');
  return (
    <div className={styles.criterion}>
      <TextField
        label={t('label')}
        hint={t('hint')}
        placeholder={t('placeholder')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        maxLength={140}
      />
      <div className={styles.chips} role="group" aria-label={t('presetsLabel')}>
        {presetKeys.map((key) => {
          const preset = t(`presets.${key}`);
          return (
            <button key={key} type="button" className={styles.chip} aria-pressed={value.trim() === preset} onClick={() => onChange(preset)}>
              {preset}
            </button>
          );
        })}
      </div>
    </div>
  );
}
