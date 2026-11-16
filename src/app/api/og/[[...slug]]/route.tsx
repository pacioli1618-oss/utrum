// Link-preview image (1200×630).
//   /api/og/<slug>        the list's card, in the list's language
//   /api/og?locale=es     the app's card (home page, or a list that no longer exists)
// Lives under /api so the locale proxy leaves it alone (see src/proxy.ts).

import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ImageResponse} from 'next/og';
import {getTranslations} from 'next-intl/server';
import {LOGO_PATHS} from '@/components/brand/Logo';
import {defaultLocale, locales, type Locale} from '@/i18n/locales';
import {getListPreview} from '@/lib/list-preview';

// Design System tokens (light theme).
const color = {
  brand: '#8A5A00',
  brandStrong: '#6B4400',
  brandTint: '#F8EED8',
  surface: '#F8F6F1',
  ink: '#1F1C16',
  inkMuted: '#625A49',
  onBrand: '#FFFFFF',
};

function UtrumSymbol({size, fill}: {size: number; fill: string}) {
  const p = LOGO_PATHS;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle {...p.chosen} fill={fill} />
      <circle {...p.other} fill="none" stroke={fill} strokeWidth={p.otherStrokeWidth} />
    </svg>
  );
}

let fontsPromise: Promise<{name: string; data: Buffer; weight: 600 | 800}[]> | undefined;
function loadFonts() {
  fontsPromise ??= Promise.all(
    (['SemiBold', 'ExtraBold'] as const).map(async (style) => ({
      name: 'Jakarta',
      data: await readFile(join(process.cwd(), `assets/fonts/PlusJakartaSans-${style}.ttf`)),
      weight: style === 'SemiBold' ? (600 as const) : (800 as const),
    })),
  );
  return fontsPromise;
}

function titleSize(title: string) {
  if (title.length <= 24) return 92;
  if (title.length <= 44) return 76;
  return 60;
}

type Card = {chip?: string; title: string; lines: string[]; cta: string};

function render(card: Card) {
  return (
    <div style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: color.surface, fontFamily: 'Jakarta'}}>
      <div style={{display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '56px 72px 0'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <UtrumSymbol size={60} fill={color.brand} />
          <div style={{display: 'flex', fontSize: 42, fontWeight: 800, letterSpacing: -1, color: color.ink}}>utrum</div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1, paddingBottom: 24}}>
          {card.chip ? (
            <div style={{display: 'flex', marginBottom: 20}}>
              <div style={{background: color.brandTint, color: color.brandStrong, fontSize: 28, fontWeight: 600, padding: '8px 24px', borderRadius: 999}}>
                {card.chip}
              </div>
            </div>
          ) : null}
          <div style={{fontSize: titleSize(card.title), fontWeight: 800, color: color.ink, letterSpacing: -2, lineHeight: 1.04, display: 'block', lineClamp: 2}}>
            {card.title}
          </div>
          {card.lines.map((line) => (
            <div key={line} style={{display: 'block', lineClamp: 2, lineHeight: 1.3, fontSize: 34, fontWeight: 600, color: color.inkMuted, marginTop: 18}}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <div style={{display: 'flex', alignItems: 'center', gap: 18, background: color.brand, color: color.onBrand, padding: '0 72px', height: 104, fontSize: 34, fontWeight: 600}}>
        <UtrumSymbol size={48} fill={color.onBrand} />
        {card.cta}
      </div>
    </div>
  );
}

function pickLocale(value: string | null): Locale {
  return (locales as readonly string[]).includes(value ?? '') ? (value as Locale) : defaultLocale;
}

export async function GET(request: Request, {params}: RouteContext<'/api/og/[[...slug]]'>) {
  const {slug: segments} = await params;
  const slug = segments?.[0];
  const preview = slug ? await getListPreview(slug) : null;

  let card: Card;
  if (preview) {
    const t = await getTranslations({locale: preview.locale, namespace: 'Preview'});
    const common = await getTranslations({locale: preview.locale, namespace: 'Common'});
    card = {chip: t('chip'), title: preview.title, lines: [preview.criterion, common('items', {count: preview.itemCount})], cta: t('cta')};
  } else {
    const locale = pickLocale(new URL(request.url).searchParams.get('locale'));
    const t = await getTranslations({locale, namespace: 'CreateList'});
    const common = await getTranslations({locale, namespace: 'Common'});
    card = {title: t('headline'), lines: [t('intro')], cta: common('tagline')};
  }

  return new ImageResponse(render(card), {
    width: 1200,
    height: 630,
    fonts: await loadFonts(),
    headers: {
      'Cache-Control': preview ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' : 'public, max-age=86400',
    },
  });
}
