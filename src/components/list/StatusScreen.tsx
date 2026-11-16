import screen from '@/components/layout/Screen.module.css';
import {AppHeader} from '@/components/layout/AppHeader';

/** A whole screen with one line: "Carregando…", "Abrindo…", or an error. */
export function StatusScreen({message, isError = false}: {message: string; isError?: boolean}) {
  return (
    <main className={screen.screen}>
      <AppHeader />
      <p role={isError ? 'alert' : 'status'} className={[screen.centered, isError && screen.errorText].filter(Boolean).join(' ')}>
        {message}
      </p>
    </main>
  );
}
