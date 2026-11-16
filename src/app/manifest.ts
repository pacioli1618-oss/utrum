import type {MetadataRoute} from 'next';

// /manifest.webmanifest · Lets people add Utrum to the home screen (PWA). No service worker:
// comparisons are saved on the server, so there is nothing useful to do offline.
// Opens on "My lists" because whoever installs it has already used the app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Utrum',
    short_name: 'Utrum',
    description: 'Priorize comparando dois de cada vez e compare a sua visão com a dos outros. Sem cadastro.',
    lang: 'pt-BR',
    start_url: '/my-lists',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f6f1',
    theme_color: '#8a5a00',
    icons: [
      {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
    ],
  };
}
