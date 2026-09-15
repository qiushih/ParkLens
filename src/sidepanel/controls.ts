import { minutesOf } from '../data/schedule';
import { localMoment } from '../results/clock';
import { formatDuration } from '../results/format';
import { DEFAULT_DURATION_MIN, DURATION_CHOICES, type StayChoice } from '../results/stay-request';
import { h } from './dom';

const DURATION_STORAGE_KEY = 'parkLens.durationMin';

export interface Controls {
  element: HTMLFormElement;
  read(): StayChoice;
  /** Relabels the day picker ("Today", "Tomorrow", …) without changing the selection. */
  setDayLabels(labels: string[]): void;
  onChange(listener: () => void): void;
}

/** The "Staying for" and "Arriving" controls. Built once, so focus survives result refreshes. */
export function createControls(now: Date): Controls {
  const form = h('form', 'controls');
  form.setAttribute('aria-label', 'Your visit');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  const savedDuration = readSavedDuration();
  const durations = fieldset(
    'Staying for',
    h('div', 'chips', ...DURATION_CHOICES.map((minutes) => chip('duration', String(minutes), formatDuration(minutes), minutes === savedDuration))),
  );

  const daySelect = h('select', null);
  daySelect.name = 'day';
  for (let offset = 0; offset < 7; offset++) {
    const option = h('option', null);
    option.value = String(offset);
    daySelect.append(option);
  }

  const timeInput = h('input', null);
  timeInput.type = 'time';
  timeInput.name = 'time';
  timeInput.step = '900';
  timeInput.value = nextHour(now);

  const later = h('div', 'arrival-later', field('Day', daySelect), field('Time', timeInput));
  later.hidden = true;

  form.append(
    durations,
    fieldset('Arriving', h('div', 'chips', chip('arrival', 'now', 'Now', true), chip('arrival', 'later', 'Later', false)), later),
  );

  const checkedValue = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? null;
  const listeners: (() => void)[] = [];
  const notify = () => {
    later.hidden = checkedValue('arrival') !== 'later';
    saveDuration(checkedValue('duration'));
    for (const listener of listeners) listener();
  };
  form.addEventListener('change', notify);
  timeInput.addEventListener('input', notify);

  return {
    element: form,
    read() {
      const durationMin = Number(checkedValue('duration') ?? DEFAULT_DURATION_MIN);
      if (checkedValue('arrival') !== 'later') return { durationMin, arrival: { kind: 'now' } };
      const time = /^\d{2}:\d{2}/.test(timeInput.value) ? timeInput.value : nextHour(new Date());
      return { durationMin, arrival: { kind: 'later', dayOffset: Number(daySelect.value), minute: minutesOf(time) } };
    },
    setDayLabels(labels) {
      labels.forEach((label, index) => {
        const option = daySelect.options[index];
        if (option && option.textContent !== label) option.textContent = label;
      });
    },
    onChange(listener) {
      listeners.push(listener);
    },
  };
}

function fieldset(legend: string, ...children: HTMLElement[]): HTMLFieldSetElement {
  return h('fieldset', 'control', h('legend', null, legend), ...children);
}

function chip(name: string, value: string, text: string, checked: boolean): HTMLLabelElement {
  const input = h('input', null);
  input.type = 'radio';
  input.name = name;
  input.value = value;
  input.checked = checked;
  return h('label', 'chip', input, h('span', null, text));
}

function field(text: string, control: HTMLElement): HTMLLabelElement {
  return h('label', 'field', h('span', null, text), control);
}

/** The next whole hour in Kitchener–Waterloo, as "HH:MM". */
function nextHour(now: Date): string {
  const nextHourOfDay = (Math.floor(localMoment(now).minute / 60) + 1) % 24;
  return `${String(nextHourOfDay).padStart(2, '0')}:00`;
}

function readSavedDuration(): number {
  try {
    const saved = Number(localStorage.getItem(DURATION_STORAGE_KEY));
    return (DURATION_CHOICES as readonly number[]).includes(saved) ? saved : DEFAULT_DURATION_MIN;
  } catch {
    return DEFAULT_DURATION_MIN;
  }
}

function saveDuration(value: string | null): void {
  if (value === null) return;
  try {
    localStorage.setItem(DURATION_STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable; the choice just isn't remembered.
  }
}
