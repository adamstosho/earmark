import { copy } from '../copy';
import { EmptyState, Logo } from '../ds/typed';
import { paths } from '../lib/router';

export function NotFound() {
  return (
    <main className="app-center-screen" id="ek-main">
      <EmptyState
        icon="magnifying-glass"
        title={copy.notFound.title}
        action={
          <a className="ek-btn ek-btn--primary ek-btn--md" href={paths.landing}>
            <span className="ek-btn__label">{copy.pocket.goHome}</span>
          </a>
        }
      >
        {copy.notFound.body}
      </EmptyState>
    </main>
  );
}

/** Shown when the site is missing its settings (config.ts), listing each problem. */
export function ConfigError({ problems }: { problems: readonly string[] }) {
  return (
    <main className="app-center-screen" id="ek-main">
      <div className="ek-stack">
        <Logo variant="wordmark" className="app-logo" />
        <h1 className="ek-type-heading-xl">{copy.config.title}</h1>
        <p className="ek-type-body">{copy.config.body}</p>
        <ul className="app-problems ek-type-mono">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="ek-type-body-sm app-muted">{copy.config.fix}</p>
      </div>
    </main>
  );
}
