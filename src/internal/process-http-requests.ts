import type { JsonComponent } from '../types';

export function processHttpRequests(json: JsonComponent) {
  const httpRequests = json?.meta?.useMetadata?.httpRequests;

  if (httpRequests) {
    for (const key in httpRequests) {
      if (!json.state[key]) {
        json.state[key] = { code: 'null', type: 'property', propertyType: 'normal' };
      }

      const value = httpRequests[key];

      // NOTE: upstream Mitosis (mitosis/packages/core/src/helpers/process-http-requests.ts)
      // interpolates `value` and `key` into the generated source without escaping.
      // A JSON input containing `");evil();("` produces a real code-injection in the emitted
      // file. We mirror the upstream behavior verbatim to maintain byte-exact parity (Phase 4);
      // the latent upstream issue should be reported separately and fixed as a documented
      // intentional divergence after parity is locked in.
      json.hooks.onMount.push({
        code: `
        fetch("${value}").then(res => res.json()).then(result => {
          state.${key} = result;
        })
        `,
      });
    }
  }
}
