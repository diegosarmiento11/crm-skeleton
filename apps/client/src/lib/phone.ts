import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type CountryCode,
} from 'libphonenumber-js';

export const DEFAULT_COUNTRY: CountryCode = 'CO';

// Countries surfaced at the top of the picker (the ones we actually sell to).
const PRIORITY: CountryCode[] = ['CO', 'US', 'MX', 'ES', 'AR', 'PE', 'CL', 'EC'];

export interface CountryOption {
  code: CountryCode;
  dial: string; // calling code without "+"
}

export const COUNTRY_OPTIONS: CountryOption[] = (() => {
  const all = getCountries().map((code) => ({ code, dial: getCountryCallingCode(code) }));
  const priority = PRIORITY.map((c) => all.find((o) => o.code === c)).filter(Boolean) as CountryOption[];
  const rest = all
    .filter((o) => !PRIORITY.includes(o.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  return [...priority, ...rest];
})();

/** Builds an E.164 string from a country + national digits ("" if no national part). */
export function buildE164(country: CountryCode, national: string): string {
  const digits = national.replace(/\D/g, '');
  if (!digits) return '';
  return `+${getCountryCallingCode(country)}${digits}`;
}

/** Splits an E.164 (or loosely-formatted) value into a country + national digits. */
export function parsePhone(value: string): { country: CountryCode; national: string } {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  if (parsed) {
    return { country: (parsed.country ?? DEFAULT_COUNTRY) as CountryCode, national: parsed.nationalNumber as string };
  }
  return { country: DEFAULT_COUNTRY, national: value.replace(/\D/g, '') };
}

export function isValidE164(value: string): boolean {
  return Boolean(value) && isValidPhoneNumber(value);
}

/** Pretty form for display, e.g. "+57 314 296 8000". Falls back to raw on failure. */
export function formatPhone(value: string): string {
  const parsed = parsePhoneNumberFromString(value);
  return parsed ? parsed.formatInternational() : value;
}
