import { useEffect } from 'react';
import { useLivePoller } from './data/live';
import { useRoute } from './lib/router';
import { applyTheme, themePref, watchSystemTheme } from './lib/theme';
import { useIsCompact } from './lib/viewport';
import { ConnectGate } from './components/Shells';
import { Toasts } from './components/Toasts';
import { ActivityPage } from './pages/Activity';
import { FamilyHome } from './pages/FamilyHome';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/Misc';
import { NewPocket } from './pages/NewPocket';
import { PayPage } from './pages/PayPage';
import { PocketDetail } from './pages/PocketDetail';
import { PublicPocket } from './pages/PublicPocket';
import { Requests } from './pages/Requests';
import { SenderDashboard } from './pages/SenderDashboard';
import { Settings } from './pages/Settings';

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
      <Page />
      <Toasts />
    </>
  );
}
