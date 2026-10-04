import { lazy, Suspense, useEffect } from 'react';
import { useLivePoller } from './data/live';
import { useDocumentTitle } from './lib/title';
import { useRoute } from './lib/router';
import { applyTheme, themePref, watchSystemTheme } from './lib/theme';
import { useIsCompact } from './lib/viewport';
import { ConnectGate } from './components/Shells';
import { ThemeSwitch } from './components/ThemeSwitch';
import { Toasts } from './components/Toasts';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/Misc';

// Only the landing page ships in the first bundle; every other screen loads when it is opened.
const ActivityPage = lazy(() => import('./pages/Activity').then((m) => ({ default: m.ActivityPage })));
const FamilyHome = lazy(() => import('./pages/FamilyHome').then((m) => ({ default: m.FamilyHome })));
const NewPocket = lazy(() => import('./pages/NewPocket').then((m) => ({ default: m.NewPocket })));
const PayPage = lazy(() => import('./pages/PayPage').then((m) => ({ default: m.PayPage })));
const PocketDetail = lazy(() => import('./pages/PocketDetail').then((m) => ({ default: m.PocketDetail })));
const PublicPocket = lazy(() => import('./pages/PublicPocket').then((m) => ({ default: m.PublicPocket })));
const Requests = lazy(() => import('./pages/Requests').then((m) => ({ default: m.Requests })));
const SenderDashboard = lazy(() => import('./pages/SenderDashboard').then((m) => ({ default: m.SenderDashboard })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

function Page() {
  const route = useRoute();
  const compact = useIsCompact();
  switch (route.name) {
    case 'landing':
      return <Landing />;
    case 'view':
      return <PublicPocket id={route.id} />;
    case 'send':
      return (
        <ConnectGate>
          <SenderDashboard />
        </ConnectGate>
      );
    case 'new':
      return (
        <ConnectGate>
          {compact ? (
            <NewPocket />
          ) : (
            <>
              <SenderDashboard />
              <NewPocket />
            </>
          )}
        </ConnectGate>
      );
    case 'requests':
      return (
        <ConnectGate>
          <Requests />
        </ConnectGate>
      );
    case 'activity':
      return (
        <ConnectGate>
          <ActivityPage view="sender" />
        </ConnectGate>
      );
    case 'pocket':
      return (
        <ConnectGate>
          <PocketDetail key={route.id.toString()} id={route.id} />
        </ConnectGate>
      );
    case 'family':
      return (
        <ConnectGate>
          <FamilyHome />
        </ConnectGate>
      );
    case 'familyActivity':
      return (
        <ConnectGate>
          <ActivityPage view="family" />
        </ConnectGate>
      );
    case 'pay':
      return (
        <ConnectGate>
          <PayPage id={route.id} mode={route.mode} />
        </ConnectGate>
      );
    case 'settings':
      return <Settings />;
    case 'notFound':
      return <NotFound />;
  }
}

export function App() {
  useLivePoller();
  const route = useRoute();
  useDocumentTitle(route);

  useEffect(() => {
    applyTheme(themePref());
    return watchSystemTheme();
  }, []);

  // Each screen starts at the top, as in a native app.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  return (
    <>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
      <ThemeSwitch />
      <Toasts />
    </>
  );
}
