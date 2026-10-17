export interface Shelf {
  id: string;
  title: string;
  count: number;
}

export const SHELVES: Shelf[] = [
  { id: 's1', title: 'Reading now', count: 3 },
  { id: 's2', title: 'Up next', count: 12 },
];
