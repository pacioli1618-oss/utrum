import {useFormatter} from 'next-intl';

/** "73%": shares and progress (0 to 1) in the person's language. */
export function useFormatPercent() {
  const format = useFormatter();
  return (value: number) => format.number(value, {style: 'percent', maximumFractionDigits: 0});
}
