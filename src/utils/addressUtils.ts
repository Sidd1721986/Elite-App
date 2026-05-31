/**
 * Address components
 */
export interface AddressParts {
  street: string;
  city: string;
  zip: string;
  state: string;
}

/**
 * Joins address parts into the requested format:
 * "Street, City Zip, State"
 */
export const formatAddress = (parts: AddressParts): string => {
  const { street, city, zip, state } = parts;
  if (!street && !city && !zip && !state) {return '';}

  // Format: "address, city zip, state"
  return `${street || ''}, ${city || ''} ${zip || ''}, ${state || ''}`
    .replace(/^, /, '') // Remove leading comma if street is missing
    .replace(/ ,$/, '') // Remove trailing comma if state is missing
    .trim();
};

/**
 * Tries to parse a single string address into parts.
 * Very basic implementation for project migration.
 */
export const parseAddress = (fullAddress: string | null | undefined): AddressParts => {
  const defaultParts: AddressParts = { street: '', city: '', zip: '', state: '' };
  if (!fullAddress) {return defaultParts;}

  try {
    const sections = fullAddress.split(',').map(s => s.trim());

    // Likely: [Street], [City Zip], [State]
    if (sections.length >= 3) {
      const street = sections[0];
      const state = sections[sections.length - 1];
      const cityZipPart = sections[1].split(' ');

      const zip = cityZipPart.pop() || '';
      const city = cityZipPart.join(' ');

      return { street, city, zip, state };
    }

    // Fallback: just put it in street
    return { ...defaultParts, street: fullAddress };
  } catch {
    return { ...defaultParts, street: fullAddress };
  }
};

/** Parsed address parts extracted from a Google Geocoding result. */
export interface GoogleValidationResult {
  valid: boolean;
  /** Google's formatted address string (always present when Google returns any result). */
  suggestion?: string;
  /** Parsed parts from Google's result — use these to auto-fill fields when user accepts. */
  correctedParts?: AddressParts;
}

/** Extract AddressParts from Google Geocoding address_components. */
function parseGeocodingComponents(components: any[]): AddressParts {
  const get = (type: string) =>
    components.find((c: any) => c.types.includes(type))?.short_name ?? '';
  const getLong = (type: string) =>
    components.find((c: any) => c.types.includes(type))?.long_name ?? '';

  const streetNumber = get('street_number');
  const route = getLong('route');
  const street = [streetNumber, route].filter(Boolean).join(' ');
  const city =
    getLong('locality') ||
    getLong('sublocality') ||
    getLong('administrative_area_level_3') ||
    getLong('postal_town');
  const zip = get('postal_code');
  const state = get('administrative_area_level_1');

  return { street, city, zip, state };
}

/**
 * Validates an address using the Google Geocoding API.
 * - `valid: true`  → address is a recognised street-level location.
 * - `valid: false` → not street-level, but Google may still provide a `suggestion`
 *                    and `correctedParts` so the user can accept the closest match.
 */
export const validateAddressWithGoogle = async (
  parts: AddressParts,
  apiKey: string
): Promise<GoogleValidationResult> => {
  const { street, city, zip, state } = parts;
  if (!street || !city || !zip || !state) {
    return { valid: false };
  }

  const query = encodeURIComponent(`${street}, ${city}, ${state} ${zip}, US`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}&components=country:US`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    // REQUEST_DENIED = key not enabled for Geocoding API → don't block the user
    if (data.status === 'REQUEST_DENIED' || data.status === 'UNKNOWN_ERROR') {
      return { valid: true };
    }

    if (data.status !== 'OK' || !data.results?.length) {
      return { valid: false };
    }

    const result = data.results[0];
    const correctedParts = parseGeocodingComponents(result.address_components ?? []);
    const suggestion: string = result.formatted_address;

    // Valid if Google found a street number — covers street_address, premise,
    // named buildings, etc. Rejects city/state/zip-only results.
    const hasStreetNumber = (result.address_components ?? []).some(
      (c: any) => c.types.includes('street_number')
    );

    if (!hasStreetNumber) {
      // Return the closest match so the user can accept it
      return { valid: false, suggestion, correctedParts };
    }

    return { valid: true, suggestion, correctedParts };
  } catch {
    // Network error — treat as valid so signup isn't blocked
    return { valid: true };
  }
};

/**
 * All 50 US States + DC
 */
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];
