import { useEffect } from 'react';
import { copy } from '../copy';
import type { Route } from './router';

const t = copy.titles;

function titleFor(route: Route): string {
  switch (route.name) {
    case 'landing':
      return t.landing;
    case 'send':
      return `${t.send} · ${copy.appName}`;
    case 'requests':
      return `${t.requests} · ${copy.appName}`;
    case 'activity':
      return `${t.activity} · ${copy.appName}`;
    case 'new':
      return `${t.newPocket} · ${copy.appName}`;
    case 'pocket':
      return `${t.pocket} ${route.id} · ${copy.appName}`;
    case 'family':
      return `${t.family} · ${copy.appName}`;
    case 'familyActivity':
      return `${t.familyActivity} · ${copy.appName}`;
    case 'pay':
      return `${route.mode === 'ask' ? t.ask : t.pay} · ${copy.appName}`;
    case 'view':
      return `${t.view} ${route.id} · ${copy.appName}`;
    case 'settings':
      return `${t.settings} · ${copy.appName}`;
    case 'notFound':
      return `${t.notFound} · ${copy.appName}`;
  }
}

/** Keeps the browser tab and history entries named after the current screen. */
export function useDocumentTitle(route: Route): void {
  const title = titleFor(route);
  useEffect(() => {
    document.title = title;
  }, [title]);
}
