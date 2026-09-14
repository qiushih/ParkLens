import { describe, expect, it } from 'vitest';
import { isGoogleMapsUrl, parseDataParam, parseDestination } from './maps-url';

// Captured from live Google Maps on 2026-09-14.
const REAL_PLACE =
  'https://www.google.com/maps/place/Kitchener+City+Hall/@43.4517589,-80.4924168,17z/data=!3m1!4b1!4m6!3m5!1s0x882bf4f34212bd1d:0x9f4531228938787d!8m2!3d43.4517589!4d-80.4924168!16zL20vMDcwZm44?entry=ttu&g_ep=EgoyMDI2MDkwOS4wIKXMDSoASAFQAw%3D%3D';
const REAL_DIRECTIONS =
  'https://www.google.com/maps/dir/University+of+Waterloo,+200+University+Ave+W,+Waterloo,+ON+N2L+3G1/Kitchener+City+Hall,+200+King+St+W,+Kitchener,+ON+N2G+4G7/@43.4616482,-80.5678258,13z/data=!3m1!4b1!4m13!4m12!1m5!1m1!1s0x882bf6ad02edccff:0xdd9df23996268e17!2m2!1d-80.5448576!2d43.4722854!1m5!1m1!1s0x882bf4f34212bd1d:0x9f4531228938787d!2m2!1d-80.4923578!2d43.4518913?entry=ttu&g_ep=EgoyMDI2MDkwOS4wIKXMDSoASAFQAw%3D%3D';

describe('isGoogleMapsUrl', () => {
  it.each([
    ['https://www.google.com/maps', true],
    ['https://www.google.com/maps/@43.46,-80.52,14z', true],
    ['https://www.google.ca/maps/place/Waterloo', true],
    ['https://www.google.com/mapsfoo', false],
    ['https://www.google.com/search?q=maps', false],
    ['http://www.google.com/maps', false],
    ['https://maps.example.com/maps', false],
    ['not a url', false],
  ])('%s → %s', (url, expected) => {
    expect(isGoogleMapsUrl(url)).toBe(expected);
  });
});

describe('parseDestination: place URLs', () => {
  it('reads a real place URL', () => {
    expect(parseDestination(REAL_PLACE)).toEqual({
      name: 'Kitchener City Hall',
      address: null,
      lat: 43.4517589,
      lng: -80.4924168,
      precision: 'exact',
    });
  });

  it('works on google.ca', () => {
    expect(parseDestination(REAL_PLACE.replace('google.com', 'google.ca'))?.lat).toBe(43.4517589);
  });

  it('uses the place pin, not the viewport, when they differ', () => {
    const url =
      'https://www.google.com/maps/place/Waterloo+Public+Square/@43.40,-80.40,17z/data=!3m1!4b1!4m7!3m6!1s0x0:0x1!8m2!3d43.4647!4d-80.5226!15sCgZzcXVhcmU!16s%2Fg%2F11';
    expect(parseDestination(url)).toMatchObject({ lat: 43.4647, lng: -80.5226, precision: 'exact' });
  });

  it('decodes percent-encoded and plus-separated names without splitting on commas', () => {
    const url =
      'https://www.google.com/maps/place/Caf%C3%A9+%2B+Bar,+King+St/@43.46,-80.52,17z/data=!4m6!3m5!1s0x0:0x0!8m2!3d43.4643!4d-80.5204!16s';
    expect(parseDestination(url)).toMatchObject({ name: 'Café + Bar, King St', address: null });
  });

  it('falls back to the viewport centre when there are no place coordinates', () => {
    const url = 'https://www.google.com/maps/place/Uptown+Waterloo/@43.4643,-80.5204,16z';
    expect(parseDestination(url)).toEqual({
      name: 'Uptown Waterloo',
      address: null,
      lat: 43.4643,
      lng: -80.5204,
      precision: 'approximate',
    });
  });

  it('returns a null name when the place segment is missing', () => {
    const url =
      'https://www.google.com/maps/place/@43.4643,-80.5204,16z/data=!4m6!3m5!1s0x0:0x0!8m2!3d43.4643!4d-80.5204!16s';
    expect(parseDestination(url)).toMatchObject({ name: null, precision: 'exact' });
  });

  it('keeps a null name when the name has invalid percent-encoding', () => {
    const url = 'https://www.google.com/maps/place/Bad%E0%A4%A/@43.4643,-80.5204,16z';
    expect(parseDestination(url)?.name).toBeNull();
  });
});

describe('parseDestination: directions URLs', () => {
  it('uses the last waypoint of a real directions URL and splits off its address', () => {
    expect(parseDestination(REAL_DIRECTIONS)).toEqual({
      name: 'Kitchener City Hall',
      address: '200 King St W, Kitchener, ON N2G 4G7',
      lat: 43.4518913,
      lng: -80.4923578,
      precision: 'exact',
    });
  });

  it('handles a blank origin', () => {
    const url =
      'https://www.google.com/maps/dir//Kitchener+City+Hall/@43.46,-80.52,13z/data=!4m8!4m7!1m0!1m5!1m1!1s0x0:0x2!2m2!1d-80.4925337!2d43.4516395';
    expect(parseDestination(url)).toMatchObject({ name: 'Kitchener City Hall', address: null });
  });

  it('returns null when the destination is blank', () => {
    const url =
      'https://www.google.com/maps/dir/Kitchener+City+Hall//@43.46,-80.52,13z/data=!4m8!4m7!1m5!1m1!1s0x0:0x2!2m2!1d-80.4925337!2d43.4516395!1m0';
    expect(parseDestination(url)).toBeNull();
  });

  it('does not mistake the origin for the destination', () => {
    const url =
      'https://www.google.com/maps/dir/Kitchener+City+Hall/somewhere+typed/@43.46,-80.52,13z/data=!4m9!4m8!1m5!1m1!1s0x0:0x2!2m2!1d-80.4925337!2d43.4516395!1m1!1ssomewhere';
    expect(parseDestination(url)).toBeNull();
  });
});

describe('parseDestination: no destination', () => {
  it.each([
    'https://www.google.com/maps',
    'https://www.google.com/maps/@43.4643,-80.5204,14z',
    'https://www.google.com/maps/search/parking/@43.4643,-80.5204,14z',
    'https://www.google.com/maps/place/Nowhere',
    'https://www.google.com/maps/place/Bad/@95,-80.52,14z',
    'https://www.example.com/maps/place/X/@43.46,-80.52,14z',
    '',
  ])('%s', (url) => {
    expect(parseDestination(url)).toBeNull();
  });
});

describe('parseDataParam', () => {
  it('nests message tokens by descendant count', () => {
    const [camera, place] = parseDataParam('!3m1!4b1!4m3!3m2!8m1!3d1.5');
    expect(camera?.children).toHaveLength(1);
    expect(place?.children[0]?.children[0]?.children[0]).toMatchObject({ field: 3, type: 'd', value: '1.5' });
  });

  it('clamps counts that overrun their parent instead of throwing', () => {
    // 4m2 owns the next two tokens, so 3m99 can only claim 1sx; 2sy and 5sz are back at the root.
    const nodes = parseDataParam('!4m2!3m99!1sx!2sy!5sz');
    expect(nodes.map((n) => n.field)).toEqual([4, 2, 5]);
    expect(nodes[0]?.children[0]?.children.map((n) => n.value)).toEqual(['x']);
  });

  it('skips malformed tokens', () => {
    expect(parseDataParam('!!garbage!1sok')).toEqual([
      { field: 1, type: 's', value: 'ok', children: [] },
    ]);
  });
});
