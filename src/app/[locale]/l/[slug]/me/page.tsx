import {Suspense} from 'react';
import {OpenPersonalScreen} from './OpenPersonalScreen';

// /l/[slug]/me · #<participantToken> · Opening a personal link stores it on this device, then shows the person's page.
export default function Page({params}: PageProps<'/[locale]/l/[slug]/me'>) {
  return (
    <Suspense>
      <Route params={params} />
    </Suspense>
  );
}

async function Route({params}: {params: PageProps<'/[locale]/l/[slug]/me'>['params']}) {
  const {slug} = await params;
  return <OpenPersonalScreen slug={slug} />;
}
