// Order matters: the stub must install `chrome` before the panel code runs.
import { PREVIEW_PLACES, setPreviewUrl } from './chrome-stub';
import '../src/sidepanel/main';

// The panel's first refresh is still awaiting, so this sets the tab it will read.
// `?place=<index>` picks the simulated tab; `?headline=` fills a store screenshot caption.
const params = new URLSearchParams(location.search);
const initialPlace = Number(params.get('place') ?? '0');
setPreviewUrl(PREVIEW_PLACES[initialPlace]?.url ?? PREVIEW_PLACES[0]?.url);

const headline = params.get('headline');
const headlineElement = document.getElementById('store-headline');
if (headline && headlineElement) headlineElement.textContent = headline;

const picker = document.getElementById('preview-place');
if (picker instanceof HTMLSelectElement) {
  PREVIEW_PLACES.forEach((place, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = place.label;
    picker.append(option);
  });
  picker.value = String(PREVIEW_PLACES[initialPlace] ? initialPlace : 0);
  picker.addEventListener('change', () => {
    setPreviewUrl(PREVIEW_PLACES[Number(picker.value)]?.url);
  });
}
