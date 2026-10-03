// Bundle entry: exposes every export on window.Earmark.
import * as Earmark from './index';
(window as any).Earmark = Object.assign((window as any).Earmark || {}, Earmark);
