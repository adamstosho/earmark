import type { CSSProperties } from 'react';
import { PocketIcon, type IconName, type PocketHue } from '../ds/typed';
import { RING_PATH, TAG_PATH } from '../ds/logo';
import { useOnScreen } from '../lib/reveal';

/** Pocket icons in the order the design system lists them (D3), each with its own hue. */
const INNER: { icon: IconName; hue: PocketHue }[] = [
  { icon: 'bowl-food', hue: 'palm' },
  { icon: 'graduation-cap', hue: 'sky' },
  { icon: 'house-line', hue: 'clay' },
];
const OUTER: { icon: IconName; hue: PocketHue }[] = [
  { icon: 'first-aid-kit', hue: 'teal' },
  { icon: 'piggy-bank', hue: 'plum' },
  { icon: 'bus', hue: 'olive' },
];
const COINS = [0, 90, 180, 270];
const SPARKS = [
  { x: '14%', y: '26%', d: '0s' },
  { x: '84%', y: '18%', d: '1.1s' },
  { x: '90%', y: '62%', d: '2.2s' },
  { x: '10%', y: '74%', d: '0.6s' },
  { x: '52%', y: '8%', d: '1.7s' },
  { x: '60%', y: '93%', d: '2.8s' },
];

const angle = (i: number, n: number): CSSProperties => ({ ['--a' as string]: `${(360 / n) * i}deg` });

/** The landing hero's motion graphic: money orbiting a tag, pockets in orbit, loops forever and pauses off screen. */
export function HeroArt() {
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  return (
    <div ref={ref} className="app-art" data-paused={visible ? undefined : ''} aria-hidden="true">
      <div className="app-art__bg">
        <span className="app-art__blob app-art__blob--a" />
        <span className="app-art__blob app-art__blob--b" />
        <span className="app-art__blob app-art__blob--c" />
        <span className="app-art__grid" />
      </div>

      <div className="app-art__square">
        <svg className="app-art__rings" viewBox="0 0 400 400" focusable="false">
          <circle className="app-art__ring app-art__ring--a" cx="200" cy="200" r="118" />
          <circle className="app-art__ring app-art__ring--b" cx="200" cy="200" r="168" />
          <circle className="app-art__ring app-art__ring--c" cx="200" cy="200" r="194" />
        </svg>

        <div className="app-art__orbit app-art__orbit--coins">
          {COINS.map((deg) => (
            <span key={deg} className="app-art__slot" style={{ ['--a' as string]: `${deg}deg` }}>
              <span className="app-art__coin" />
            </span>
          ))}
        </div>

        <div className="app-art__orbit app-art__orbit--inner">
          {INNER.map((c, i) => (
            <span key={c.icon} className="app-art__slot" style={angle(i, INNER.length)}>
              <span className="app-art__chip">
                <PocketIcon icon={c.icon} hue={c.hue} size="md" />
              </span>
            </span>
          ))}
        </div>

        <div className="app-art__orbit app-art__orbit--outer">
          {OUTER.map((c, i) => (
            <span key={c.icon} className="app-art__slot" style={angle(i, OUTER.length)}>
              <span className="app-art__chip">
                <PocketIcon icon={c.icon} hue={c.hue} size="md" />
              </span>
            </span>
          ))}
        </div>

        <div className="app-art__core">
          <span className="app-art__halo" />
          <span className="app-art__halo app-art__halo--late" />
          <svg className="app-art__tag" viewBox="0 0 64 64" focusable="false">
            <path className="ek-logo__tag" fillRule="evenodd" d={TAG_PATH} />
            <path className="ek-logo__ring" fillRule="evenodd" d={RING_PATH} />
          </svg>
        </div>

        <div className="app-art__card app-art__card--one">
          <PocketIcon icon="bowl-food" hue="palm" size="sm" />
          <span className="app-art__lines">
            <span className="app-art__line" />
            <span className="app-art__track">
              <span className="app-art__fill" />
            </span>
          </span>
        </div>
        <div className="app-art__card app-art__card--two">
          <PocketIcon icon="graduation-cap" hue="sky" size="sm" />
          <span className="app-art__lines">
            <span className="app-art__line" />
            <span className="app-art__track">
              <span className="app-art__fill app-art__fill--sky" />
            </span>
          </span>
        </div>

        {SPARKS.map((s) => (
          <span key={s.x + s.y} className="app-art__spark" style={{ left: s.x, top: s.y, animationDelay: s.d }} />
        ))}
      </div>
    </div>
  );
}
