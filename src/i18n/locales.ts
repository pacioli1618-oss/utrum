// Single source of supported locales.
// To add one: list it here, create messages/<locale>.json and run `npm run i18n:check`.

export const locales = ['pt-BR', 'es', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt-BR';

// Each language's name written in itself, for the switcher.
export const localeNames: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
