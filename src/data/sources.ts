import type { DatasetId } from './types.ts';

export interface DatasetInfo {
  name: string;
  publisher: string;
  /** ArcGIS FeatureServer layer the fetch script queries. */
  serviceUrl: string;
  /** Public dataset page, for attribution links. */
  pageUrl: string;
  license: string;
  licenseUrl: string;
  /** Wording each licence asks for when crediting (credit is optional under both). */
  attribution: string;
}

const KITCHENER_LICENSE = {
  license: 'Open Government Licence - The Corporation of the City of Kitchener',
  licenseUrl: 'https://www.kitchener.ca/council-and-city-administration/data-and-maps/open-data-licence/',
  attribution: 'Contains information licensed under the Open Government Licence - The Corporation of the City of Kitchener',
};

export const DATASETS: Readonly<Record<DatasetId, DatasetInfo>> = {
  'kitchener-on-street': {
    name: 'Parking On Street',
    publisher: 'City of Kitchener',
    serviceUrl: 'https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Parking_On_Street/FeatureServer/0',
    pageUrl: 'https://open-kitchenergis.opendata.arcgis.com/datasets/KitchenerGIS::parking-on-street',
    ...KITCHENER_LICENSE,
  },
  'kitchener-public-lots': {
    name: 'Parking Public Lots',
    publisher: 'City of Kitchener',
    serviceUrl: 'https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Parking_Public_Lots/FeatureServer/0',
    pageUrl: 'https://open-kitchenergis.opendata.arcgis.com/datasets/KitchenerGIS::parking-public-lots',
    ...KITCHENER_LICENSE,
  },
  'waterloo-city-lots': {
    name: 'Parking Lots (City Operated)',
    publisher: 'City of Waterloo',
    serviceUrl: 'https://services.arcgis.com/ZpeBVw5o1kjit7LT/arcgis/rest/services/ParkingLots/FeatureServer/0',
    pageUrl: 'https://data.waterloo.ca/datasets/City-of-Waterloo::parking-lots-city-operated',
    license: 'Waterloo Open Data User Licence',
    licenseUrl: 'https://data.waterloo.ca/pages/open-data-licence',
    attribution: 'Contains information provided by the City of Waterloo under licence',
  },
};
