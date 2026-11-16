import {Logo} from '@/components/brand/Logo';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import {Link} from '@/i18n/navigation';
import styles from './Screen.module.css';

/** Logo (back to the home page) and the language switcher, on every screen. */
export function AppHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" aria-label="Utrum" className={styles.logoLink}>
        <Logo />
      </Link>
      <LocaleSwitcher />
    </header>
  );
}
