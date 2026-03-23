export const GOOGLE_PLACE_RESOURCE_BY_APP_ID: Record<number, string> = {
  // Fill each value with Google Places resource name format: places/XXXXXXXXXXXXXXXX
  // Example: 1: 'places/ChIJxxxxxxxxxxxxxxxx',
  1: '',
  2: '',
  3: 'places/ChIJuZxn7NAScTERQB4WFRsQ3Wk',
  4: '',
  5: '',
  6: '',
  7: '',
  8: '',
  9: '',
  10: '',
  11: 'places/ChIJTSU0UWoTcTERj_2WUIYU9zU',
  12: 'places/ChIJzTYGMDoTcTER_P86xsmFeLg',
  13: 'places/ChIJ8375_n0TcTERf_KnBIjhK4E',
  14: 'places/ChIJlY79uNMTcTERVYjheksxPKs',
  101: '',
  102: '',
  103: '',
  104: '',
};

export function getGooglePlaceResourceByAppId(appId?: number): string {
  if (typeof appId !== 'number') {
    return '';
  }

  return GOOGLE_PLACE_RESOURCE_BY_APP_ID[appId] ?? '';
}
