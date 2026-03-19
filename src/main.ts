import './style.css';
import { inject } from '@vercel/analytics';
import { getLocationFromBrowser, reverseGeocode, searchLocations } from './location.ts';
import { fetchWeather, calculatePintScore } from './weather.ts';
import { fetchNearbyPubs } from './pubs.ts';
import {
  showLoading,
  renderVerdict,
  renderWeather,
  renderPubs,
  renderError,
  renderPubsLoading,
  spinRefresh,
  esc,
} from './ui.ts';
import type { PubResult } from './pubs.ts';
import type { Coords, LocationResult } from './types.ts';

// Initialize Vercel Web Analytics
inject();

const CACHE_KEY = 'pintweather_cache';

interface CacheEntry {
  coords: Coords;
  name: string;
  timestamp: number;
}

function getCached(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    // Cache for 15 minutes
    if (Date.now() - entry.timestamp > 15 * 60 * 1000) return null;
    return entry;
  } catch {
    return null;
  }
}

function setCache(coords: Coords, name: string) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ coords, name, timestamp: Date.now() }));
}

async function runApp(coords: Coords, locationName: string) {
  showLoading();
  renderPubsLoading();
  setCache(coords, locationName);

  // Fire both requests in parallel
  const weatherPromise = fetchWeather(coords);
  const pubsPromise = fetchNearbyPubs(coords).catch((): PubResult => ({ pubs: [], isFallback: false }));

  // Render verdict as soon as weather arrives (don't wait for pubs)
  try {
    const weather = await weatherPromise;
    const verdict = calculatePintScore(weather);
    renderVerdict(verdict, locationName);
    renderWeather(weather);
  } catch {
    renderError('Couldn\'t fetch the weather. Try again?');
    return;
  }

  // Render pubs when they arrive
  const { pubs, isFallback } = await pubsPromise;
  renderPubs(pubs, isFallback);
}

async function initFromBrowser() {
  showLoading();
  try {
    const coords = await getLocationFromBrowser();
    const name = await reverseGeocode(coords);
    runApp(coords, name);
  } catch {
    // Geolocation denied or failed — just show input prompt
    document.body.classList.remove('loading');
    const input = document.getElementById('location-input') as HTMLInputElement;
    input.focus();
    input.placeholder = 'Type a place to check pint weather...';
  }
}

function setupEventListeners() {
  const form = document.getElementById('location-form')!;
  const input = document.getElementById('location-input') as HTMLInputElement;
  const suggestions = document.getElementById('location-suggestions')!;
  const geoBtn = document.getElementById('geolocate-btn')!;
  const checkAgain = document.getElementById('check-again')!;
  const shareBtn = document.getElementById('share-btn')!;

  let debounceTimer: ReturnType<typeof setTimeout>;
  let currentResults: LocationResult[] = [];
  let activeIndex = -1;

  function closeSuggestions() {
    suggestions.classList.remove('open');
    suggestions.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    currentResults = [];
    activeIndex = -1;
  }

  function selectResult(result: LocationResult) {
    input.value = result.name;
    closeSuggestions();
    input.blur();
    runApp(result.coords, result.name);
  }

  function renderSuggestions(results: LocationResult[]) {
    currentResults = results;
    activeIndex = -1;
    if (!results.length) {
      closeSuggestions();
      return;
    }
    suggestions.innerHTML = results
      .map((r, i) => `<li role="option" data-index="${i}">${esc(r.name)}</li>`)
      .join('');
    suggestions.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  }

  function updateActive() {
    suggestions.querySelectorAll('li').forEach((li, i) => {
      li.classList.toggle('active', i === activeIndex);
    });
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearTimeout(debounceTimer);
    if (query.length < 2) {
      closeSuggestions();
      return;
    }
    debounceTimer = setTimeout(async () => {
      const results = await searchLocations(query, 5);
      // Only show if input still matches (user may have kept typing)
      if (input.value.trim() === query) {
        renderSuggestions(results);
      }
    }, 500);
  });

  input.addEventListener('keydown', (e) => {
    if (!currentResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive();
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectResult(currentResults[activeIndex]);
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  });

  suggestions.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('li');
    if (!li) return;
    const idx = parseInt(li.dataset.index || '', 10);
    if (currentResults[idx]) selectResult(currentResults[idx]);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!form.contains(e.target as Node)) closeSuggestions();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    closeSuggestions();
    const query = input.value.trim();
    if (!query) return;
    showLoading();
    const results = await searchLocations(query, 1);
    if (results.length) {
      input.blur();
      runApp(results[0].coords, results[0].name);
    } else {
      renderError('Couldn\'t find that place. Try another?');
    }
  });

  geoBtn.addEventListener('click', () => {
    closeSuggestions();
    initFromBrowser();
  });

  checkAgain.addEventListener('click', () => {
    spinRefresh();
    const cached = getCached();
    if (cached) {
      runApp(cached.coords, cached.name);
    } else {
      initFromBrowser();
    }
  });

  shareBtn.addEventListener('click', async () => {
    const verdict = document.getElementById('verdict')?.textContent;
    const subtitle = document.getElementById('subtitle')?.textContent;
    try {
      await navigator.share({
        title: 'Is It Pint Weather?',
        text: `${verdict} — ${subtitle}`,
        url: window.location.href,
      });
    } catch {
      // User cancelled or share not supported
    }
  });
}

// Boot
setupEventListeners();

const cached = getCached();
if (cached) {
  runApp(cached.coords, cached.name);
} else {
  initFromBrowser();
}
