// Order matters: the stub must install `chrome` before the panel code runs.
import { PREVIEW_PLACES, setPreviewUrl } from './chrome-stub';
import '../src/sidepanel/main';

const picker = document.getElementById('preview-place');
if (picker instanceof HTMLSelectElement) {
  PREVIEW_PLACES.forEach((place, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = place.label;
    picker.append(option);
  });
  picker.addEventListener('change', () => {
    setPreviewUrl(PREVIEW_PLACES[Number(picker.value)]?.url);
  });
}
