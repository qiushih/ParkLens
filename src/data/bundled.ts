import raw from './parking.kw.json';
import type { ParkingDataset } from './types.ts';

/** The dataset built by `npm run data:build`. Its contents are validated by src/data/dataset.test.ts. */
export const PARKING_DATASET = raw as unknown as ParkingDataset;
