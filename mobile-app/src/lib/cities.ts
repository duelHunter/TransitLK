/**
 * Main cities offered in the From/To pickers. Keep in sync with the routes seeded by
 * ticketing-service (DataSeeder) and with web-portal/src/lib/cities.ts.
 */
export const MAIN_CITIES: readonly string[] = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kurunegala',
  'Matara',
  'Negombo',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
];

/** Returns a message for an unusable origin/destination pair, or null when the search can run. */
export function searchError(origin: string, destination: string): string | null {
  if (!origin) return 'Choose where you are travelling from.';
  if (!destination) return 'Choose where you are travelling to.';
  if (origin === destination) return 'Origin and destination must be different cities.';
  return null;
}
