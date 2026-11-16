import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import screen from '@/components/layout/Screen.module.css';
import {MyListsLink} from '@/components/MyListsLink';
import {CreateListForm} from './CreateListForm';
import styles from './CreateList.module.css';

// Home · Create a list. Static shell; the form runs in the browser (device id, tokens).
export default function CreateListPage() {
  const t = useTranslations('CreateList');

  return (
    <main className={screen.screen}>
      <AppHeader />
      <MyListsLink />
      <section className={styles.intro}>
        <h1 className={styles.headline}>{t('headline')}</h1>
        <p className={styles.lead}>{t('intro')}</p>
      </section>
      <CreateListForm />
    </main>
  );
}
