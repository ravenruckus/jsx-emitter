import type { JsonComponent, Plugin } from '../types';

export const runPreJsonPlugins = ({
  json,
  plugins,
  options,
}: {
  json: JsonComponent;
  plugins: Plugin[];
  options?: any;
}) => {
  let useJson = json;
  for (const plugin of plugins) {
    const preFunction = plugin(options).json?.pre;
    if (preFunction) {
      useJson = preFunction(json) || json;
    }
  }
  return useJson;
};

export const runPostJsonPlugins = ({
  json,
  plugins,
  options,
}: {
  json: JsonComponent;
  plugins: Plugin[];
  options?: any;
}) => {
  let useJson = json;
  for (const plugin of plugins) {
    const postFunction = plugin(options).json?.post;
    if (postFunction) {
      useJson = postFunction(json) || json;
    }
  }
  return useJson;
};

export const runPreCodePlugins = ({
  code,
  plugins,
  options,
  json,
}: {
  json: JsonComponent;
  code: string;
  plugins: Plugin[];
  options?: any;
}) => {
  let string = code;
  for (const plugin of plugins) {
    const preFunction = plugin(options).code?.pre;
    if (preFunction) {
      string = preFunction(string, json);
    }
  }
  return string;
};

export const runPostCodePlugins = ({
  code,
  plugins,
  options,
  json,
}: {
  json: JsonComponent;
  code: string;
  plugins: Plugin[];
  options?: any;
}) => {
  let string = code;
  for (const plugin of plugins) {
    const postFunction = plugin(options).code?.post;
    if (postFunction) {
      string = postFunction(string, json);
    }
  }
  return string;
};
