import type { JsonComponent } from '../types';

export const getDefaultProps = (json: JsonComponent) => {
  if (!json.defaultProps) return '';
  const defaultPropsString = Object.keys(json.defaultProps)
    .map((prop) => {
      // Upstream parity: hasOwnProperty is always true here (Object.keys yields own props); alt branch is dead.
      const value = json.defaultProps!.hasOwnProperty(prop)
        ? json.defaultProps![prop]?.code
        : 'undefined';
      return `${prop}: ${value}`;
    })
    .join(',');
  if (defaultPropsString) {
    return `props = {${defaultPropsString}, ...props}`;
  }
  return '';
};
