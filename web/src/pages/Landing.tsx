import { useEffect } from 'react';
import { useEnv } from '../app/env';
import { copy } from '../copy';
import { Button, Logo, PocketCard } from '../ds/typed';
import { usePocket, useRoles } from '../data/hooks';
import { pocketCardProps } from '../components/Pockets';
import { homeFor, homePath } from '../components/Shells';
import { ConnectButton, LoadError, PocNotice, useNairaRate, useWallet } from '../components/System';
import { navigate, paths } from '../lib/router';
import { useIsExpanded } from '../lib/viewport';

/** Landing (/#/): the pitch, how it works, Connect wallet and a live pocket anyone can open. */
export function Landing() {
  const env = useEnv();
  const expanded = useIsExpanded();
  const rate = useNairaRate();
  const { address } = useWallet();
  const roles = useRoles(address);
  const demoId = env.config.demoPocketId ?? undefined;
  const demo = usePocket(demoId);

  // D10: once connected, go to the right home.
  useEffect(() => {
    if (address && roles.data) navigate(homePath(homeFor(roles.data)));
  }, [address, roles.data]);

  const live = demo.data ?? null;

  return (
    <div className="app-landing">
      <header className="app-landing__bar">
        <Logo variant="wordmark" />
      </header>
      <main className="ek-page" id="ek-main">
        <section className="app-hero" aria-labelledby="hero-title">
          <div className="app-hero__copy">
            <h1 id="hero-title" className={expanded ? 'ek-type-display-xl' : 'ek-type-display-lg'}>
              {copy.landing.headline}
            </h1>
            <p className="ek-type-body-lg app-muted">{copy.landing.lede}</p>
            <div className="app-hero__cta">
              {address === undefined ? (
                <ConnectButton block={!expanded} />
              ) : roles.isError ? (
                <LoadError onRetry={() => void roles.refetch()} />
              ) : (
                <Button variant="primary" size="lg" block={!expanded} loading>
                  {copy.wallet.connecting}
                </Button>
              )}
              {live ? (
                <a className="ek-btn ek-btn--ghost ek-btn--lg" href={paths.view(live.id)}>
                  <span className="ek-btn__label">{copy.landing.seeLive}</span>
                </a>
              ) : null}
            </div>
          </div>
          {expanded && live ? (
            <figure className="app-figure app-stack-sm">
              <PocketCard
                {...pocketCardProps(live, rate)}
                view="family"
                onPay={() => navigate(paths.view(live.id))}
                onAsk={() => navigate(paths.view(live.id))}
              />
              <figcaption className="ek-type-caption app-subtle">{copy.landing.cardCaption}</figcaption>
            </figure>
          ) : null}
        </section>

        <section className="app-landing__section" aria-labelledby="how">
          <h2 id="how" className="ek-type-heading-lg">
            {copy.landing.stepsTitle}
          </h2>
          <ol className="app-steps">
            {copy.landing.steps.map((step, i) => (
              <li key={step.title} className="app-step">
                <span className="app-step__num ek-type-label" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="ek-type-heading-sm">{step.title}</h3>
                <p className="ek-type-body-sm app-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="app-landing__section">
          <PocNotice />
        </section>
      </main>
    </div>
  );
}
