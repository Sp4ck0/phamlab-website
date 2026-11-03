// Element id of a tile (hotel, flight, activity…) inside a day card. The key is
// the tile's own stable id (a booking id, or `act:<index>`), so a shared link
// (?day=…&tile=…) can find it again.
export const tileDomId = (rowId: string, tileKey: string) => `${rowId}-tile-${tileKey}`;
