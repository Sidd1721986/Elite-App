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
  if (!street && !city && !zip && !state) return '';
  
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
  if (!fullAddress) return defaultParts;

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

/**
 * All 50 US States + DC
 */
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];
