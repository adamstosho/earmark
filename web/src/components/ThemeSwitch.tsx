import { useSyncExternalStore } from 'react';
import { copy } from '../copy';
import { useRoute } from '../lib/router';
import { isDark, subscribeTheme, toggleTheme } from '../lib/theme';

function useDark(): boolean {
  return useSyncExternalStore(subscribeTheme, isDark);
}

/** Floating Light/Dark switch, on every page. A sun that turns into a moon; the new theme spreads out from the press. */
export function ThemeSwitch() {
  const dark = useDark();
  const route = useRoute();
  // The bottom tab bar (below 600px) is on every signed-in screen; the landing and public pages have none.
  const tabbar = route.name !== 'landing' && route.name !== 'view' && route.name !== 'notFound';
  const label = dark ? copy.themeSwitch.toLight : copy.themeSwitch.toDark;
  return (
    <button
      type="button"
      className="app-themeswitch"
      data-dark={dark ? '' : undefined}
      data-tabbar={tabbar ? '' : undefined}
      aria-label={label}
      title={label}
      onClick={(e) => {
        // Keyboard activation reports 0,0; fall back to the button's own centre.
        const box = e.currentTarget.getBoundingClientRect();
        const x = e.clientX || box.left + box.width / 2;
        const y = e.clientY || box.top + box.height / 2;
        toggleTheme({ x, y });
      }}
    >
      <svg className="app-themeswitch__svg" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <mask id="app-moon-mask">
            <rect x="0" y="0" width="24" height="24" fill="white" />
            <circle className="app-themeswitch__bite" cx="30" cy="2" r="7" fill="black" />
          </mask>
        </defs>
        <g className="app-themeswitch__rays">
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
          <line x1="4.6" y1="4.6" x2="6.4" y2="6.4" />
          <line x1="17.6" y1="17.6" x2="19.4" y2="19.4" />
          <line x1="4.6" y1="19.4" x2="6.4" y2="17.6" />
          <line x1="17.6" y1="6.4" x2="19.4" y2="4.6" />
        </g>
        <circle className="app-themeswitch__body" cx="12" cy="12" r="6" mask="url(#app-moon-mask)" />
        <circle className="app-themeswitch__star app-themeswitch__star--a" cx="19" cy="5" r="1" />
        <circle className="app-themeswitch__star app-themeswitch__star--b" cx="21" cy="10" r="0.7" />
      </svg>
    </button>
  );
}
