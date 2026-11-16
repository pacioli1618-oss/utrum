// Utrum mark: two circles, one chosen. "Utrum" is Latin for "which of the two?". The circles'
// radii are in the golden ratio (14 : 14/φ), GR1618's signature.
// Same geometry as app/icon.svg, the PWA icons in public/icons/ and the link-preview image.
// The wordmark is live text in the app font, so it stays crisp and is read by screen readers.

export const LOGO_PATHS = {
  /** The chosen one: filled. */
  chosen: {cx: 21, cy: 32, r: 14},
  /** The other one: outlined, smaller by φ. */
  other: {cx: 46.65, cy: 32, r: 8.65},
  otherStrokeWidth: 3,
} as const;

export function LogoSymbol({size = 28}: {size?: number}) {
  const p = LOGO_PATHS;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle {...p.chosen} fill="var(--brand)" />
      <circle {...p.other} fill="none" stroke="var(--brand)" strokeWidth={p.otherStrokeWidth} />
    </svg>
  );
}

/** Horizontal logo: symbol + "utrum". */
export function Logo() {
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
      <LogoSymbol />
      <span style={{fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em'}}>utrum</span>
    </span>
  );
}
