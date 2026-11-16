import {Suspense} from 'react';
import {ListScreen} from './ListScreen';

// /l/[slug] · List link: join with your own name, then your personal page (compare, ranking, results).
export default function Page({params}: PageProps<'/[locale]/l/[slug]'>) {
  return (
    <Suspense>
      <Route params={params} />
    </Suspense>
  );
}

async function Route({params}: {params: PageProps<'/[locale]/l/[slug]'>['params']}) {
  const {slug} = await params;
  return <ListScreen slug={slug} />;
}
