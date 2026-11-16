'use client';

import {CopyButton} from '@/components/ui/CopyButton';
import {displayUrl} from '@/lib/share-links';
import styles from './List.module.css';

/** A link shown in full (so people can check it) with a copy button. */
export function LinkBox({url}: {url: string}) {
  return (
    <div className={styles.linkBox}>
      <code className={styles.linkText}>{displayUrl(url)}</code>
      <CopyButton text={url} variant="secondary" />
    </div>
  );
}
