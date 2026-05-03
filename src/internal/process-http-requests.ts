import type { JsonComponent } from '../types';

export function processHttpRequests(json: JsonComponent) {
  const httpRequests = json?.meta?.useMetadata?.httpRequests;

  if (httpRequests) {
    for (const key in httpRequests) {
      if (!json.state[key]) {
        json.state[key] = { code: 'null', type: 'property', propertyType: 'normal' };
      }

      const value = httpRequests[key];

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
