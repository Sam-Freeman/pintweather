import type { WeatherData, PintVerdict, Pub } from './types.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function esc(str: string): string {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

export function setTheme(isPintWeather: boolean) {
  document.body.classList.toggle('yes', isPintWeather);
  document.body.classList.toggle('no', !isPintWeather);
}

export function showLoading() {
  $('verdict').textContent = '';
  $('verdict').innerHTML = '<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>';
  $('subtitle').textContent = '';
  $('location-name').textContent = '';
  $('weather-strip').innerHTML = '';
  $('pub-list').innerHTML = '';
  $('pub-heading').textContent = '';
  $('check-again').style.display = 'none';
  $('share-btn').style.display = 'none';
  document.body.classList.remove('yes', 'no');
  document.body.classList.add('loading');
}

export function renderVerdict(verdict: PintVerdict, locationName: string) {
  document.body.classList.remove('loading');
  setTheme(verdict.isPintWeather);

  const verdictEl = $('verdict');
  verdictEl.innerHTML = '';
  verdictEl.textContent = verdict.verdict;
  verdictEl.classList.add('enter');

  const subtitleEl = $('subtitle');
  subtitleEl.textContent = verdict.subtitle;
  subtitleEl.classList.add('enter');

  const locEl = $('location-name');
  locEl.textContent = locationName;
  locEl.classList.add('enter');

  $('check-again').style.display = '';
  if ('share' in navigator) {
    $('share-btn').style.display = '';
  }

  // Re-trigger animations
  requestAnimationFrame(() => {
    verdictEl.classList.remove('enter');
    void verdictEl.offsetWidth;
    verdictEl.classList.add('enter');

    subtitleEl.classList.remove('enter');
    void subtitleEl.offsetWidth;
    subtitleEl.classList.add('enter');

    locEl.classList.remove('enter');
    void locEl.offsetWidth;
    locEl.classList.add('enter');
  });
}

export function renderWeather(w: WeatherData) {
  const strip = $('weather-strip');
  const stats = [
    { value: `${Math.round(w.apparentTemperature)}°`, label: 'Feels like' },
    { value: `${Math.round(w.windSpeed)}km/h`, label: 'Wind' },
    { value: `${w.rain}mm`, label: 'Rain' },
    { value: `${Math.round(w.cloudCover)}%`, label: 'Cloud' },
  ];

  strip.innerHTML = stats
    .map(
      (s) => `
    <div class="weather-stat">
      <span class="weather-value">${s.value}</span>
      <span class="weather-label">${s.label}</span>
    </div>
  `
    )
    .join('');

  strip.classList.add('enter');
}

export function renderPubs(pubs: Pub[], isFallback: boolean) {
  const heading = $('pub-heading');
  const list = $('pub-list');

  if (pubs.length === 0) {
    heading.textContent = 'No pubs nearby';
    list.innerHTML = '<li class="pub-empty">That\'s the real tragedy.</li>';
    return;
  }

  heading.textContent = isFallback ? 'Nearest pubs' : 'Nearest beer gardens';
  list.innerHTML = pubs
    .map(
      (pub, i) => {
        const tag = pub.hasBeerGarden
          ? 'Beer garden'
          : pub.hasOutdoorSeating
            ? 'Outdoor seating'
            : 'Pub';
        return `
    <li class="pub-item" style="animation-delay: ${i * 60}ms">
      <div class="pub-info">
        <span class="pub-name">${esc(pub.name)}</span>
        <span class="pub-tags">${tag}</span>
      </div>
      <div class="pub-meta">
        <span class="pub-distance">${pub.distance < 1 ? `${Math.round(pub.distance * 1000)}m` : `${pub.distance.toFixed(1)}km`}</span>
        <a class="pub-directions" href="${pub.directionsUrl}" target="_blank" rel="noopener">Directions&nbsp;&rarr;</a>
      </div>
    </li>
  `;
      }
    )
    .join('');
}

export function renderError(message: string) {
  document.body.classList.remove('loading', 'yes', 'no');
  $('verdict').textContent = '';
  $('subtitle').textContent = message;
  $('location-name').textContent = '';
  $('check-again').style.display = '';
}

export function renderPubsLoading() {
  $('pub-heading').textContent = 'Finding beer gardens...';
  $('pub-list').innerHTML = '';
}

export function spinRefresh() {
  const icon = document.querySelector('.refresh-icon');
  if (icon) {
    icon.classList.add('spinning');
    setTimeout(() => icon.classList.remove('spinning'), 600);
  }
}
