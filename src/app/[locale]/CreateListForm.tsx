'use client';

import {useState, type FormEvent} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {LegalLinks} from '@/components/legal/LegalLinks';
import screen from '@/components/layout/Screen.module.css';
import {CriterionField} from '@/components/list/CriterionField';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {TextAreaField} from '@/components/ui/TextAreaField';
import {TextField} from '@/components/ui/TextField';
import {useRpcErrorMessage} from '@/i18n/errors';
import {useRouter} from '@/i18n/navigation';
import {createList} from '@/lib/api';
import {getDeviceId, rememberList} from '@/lib/device-store';
import {expectedComparisons, type Method} from '@/lib/ranking';
import {parseItems} from '@/lib/share-links';
import styles from './CreateList.module.css';

const MAX_ITEMS = 100;
const methods: readonly Method[] = ['quick', 'full'];

export function CreateListForm() {
  const t = useTranslations('CreateList');
  const criterionText = useTranslations('Criterion');
  const common = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const rpcErrorMessage = useRpcErrorMessage();

  const [title, setTitle] = useState('');
  const [criterion, setCriterion] = useState(() => criterionText('presets.important'));
  const [criterionDetail, setCriterionDetail] = useState('');
  const [method, setMethod] = useState<Method>('quick');
  const [itemsText, setItemsText] = useState('');
  const [hostName, setHostName] = useState('');
  const [isHostTakingPart, setIsHostTakingPart] = useState(true);
  const [errors, setErrors] = useState<{title?: string; criterion?: string; items?: string; name?: string}>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = parseItems(itemsText);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedCriterion = criterion.trim();
    const trimmedName = hostName.trim();
    const nextErrors = {
      title: trimmedTitle ? undefined : t('titleRequired'),
      criterion: trimmedCriterion ? undefined : criterionText('required'),
      items: items.length < 2 ? t('itemsRequired') : items.length > MAX_ITEMS ? t('itemsTooMany', {max: MAX_ITEMS}) : undefined,
      name: isHostTakingPart && !trimmedName ? t('hostNameRequired') : undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const created = await createList({
        title: trimmedTitle,
        criterion: trimmedCriterion,
        criterionDetail: criterionDetail.trim() || undefined,
        method,
        items,
        locale,
        deviceId: getDeviceId(),
        hostName: isHostTakingPart ? trimmedName : undefined,
      });
      // The tokens exist only here and on this device from now on: save them before moving on.
      rememberList({
        slug: created.slug,
        title: trimmedTitle,
        hostToken: created.hostToken,
        participantToken: created.participantToken ?? undefined,
      });
      // Next keeps this screen's state for when the person comes back (cacheComponents): leave it
      // as a blank form, not stuck on "sending" with the previous list in it. The name stays.
      setTitle('');
      setCriterion(criterionText('presets.important'));
      setCriterionDetail('');
      setMethod('quick');
      setItemsText('');
      setIsSubmitting(false);
      router.push(`/l/${created.slug}/host`);
    } catch (error) {
      setFormError(rpcErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Card variant="large" className={styles.fields}>
        <TextField
          label={t('title')}
          placeholder={t('titlePlaceholder')}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (errors.title) setErrors({...errors, title: undefined});
          }}
          error={errors.title}
          maxLength={120}
          required
        />

        <CriterionField
          value={criterion}
          onChange={(value) => {
            setCriterion(value);
            if (errors.criterion) setErrors({...errors, criterion: undefined});
          }}
          error={errors.criterion}
        />

        <TextField
          label={`${criterionText('detailLabel')} (${common('optional')})`}
          hint={criterionText('detailHint')}
          placeholder={criterionText('detailPlaceholder')}
          value={criterionDetail}
          onChange={(event) => setCriterionDetail(event.target.value)}
          maxLength={300}
        />

        <TextAreaField
          label={t('items')}
          hint={t('itemsHint')}
          placeholder={t('itemsPlaceholder')}
          value={itemsText}
          onChange={(event) => {
            setItemsText(event.target.value);
            if (errors.items) setErrors({...errors, items: undefined});
          }}
          error={errors.items}
          rows={7}
        />
        {items.length > 0 && (
          <span className={styles.count} aria-live="polite">
            {t('itemsCount', {count: items.length, comparisons: expectedComparisons(items.length, method)})}
          </span>
        )}

        <div className={styles.fields}>
          <span className={styles.groupLabel} id="method-label">
            {t('method')}
          </span>
          <div className={styles.methods} role="radiogroup" aria-labelledby="method-label">
            {methods.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                className={styles.method}
                onClick={() => setMethod(value)}
              >
                <span className={styles.methodTitle}>{t(`methods.${value}.title`)}</span>
                <span className={styles.methodHint}>{t(`methods.${value}.hint`)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.host}>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={isHostTakingPart} onChange={(event) => setIsHostTakingPart(event.target.checked)} />
            <span>
              <strong>{t('hostTakesPart')}</strong>
              <span className={styles.hint}>{t('hostTakesPartHint')}</span>
            </span>
          </label>
          {isHostTakingPart && (
            <TextField
              label={t('hostName')}
              hint={t('hostNameHint')}
              value={hostName}
              onChange={(event) => {
                setHostName(event.target.value);
                if (errors.name) setErrors({...errors, name: undefined});
              }}
              error={errors.name}
              maxLength={60}
              autoComplete="given-name"
            />
          )}
        </div>
      </Card>

      <div className={screen.footer}>
        {formError && (
          <p className={screen.formError} role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" size="cta" isFullWidth isLoading={isSubmitting}>
          {t('submit')}
        </Button>
        <p className={screen.tagline}>{common('tagline')}</p>
        <LegalLinks />
      </div>
    </form>
  );
}
