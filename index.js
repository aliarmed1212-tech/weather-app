"use strict";

/*
============================================================
 WEATHERX
 Professional JavaScript Weather Dashboard
============================================================

 Primary weather source:
 Open-Meteo

 Geocoding:
 Open-Meteo Geocoding API

 Air Quality:
 Open-Meteo Air Quality API

 Radar:
 RainViewer public Weather Maps API

 Map:
 Leaflet loaded dynamically

 This application:
 - Searches cities
 - Shows current weather
 - Shows hourly forecast
 - Shows 16-day forecast
 - Shows charts
 - Shows air quality
 - Shows sunrise/sunset
 - Shows favorites
 - Shows recent searches
 - Supports geolocation
 - Supports Celsius/Fahrenheit
 - Supports wind-unit conversion
 - Supports dark/light/system theme
 - Supports weather backgrounds
 - Supports radar map
 - Supports sharing
 - Supports printing
 - Handles errors
 - Uses localStorage
============================================================
*/


/* ==========================================================
   1. CONFIGURATION
========================================================== */

const CONFIG = {

    WEATHER_API:
        "https://api.open-meteo.com/v1/forecast",

    GEOCODING_API:
        "https://geocoding-api.open-meteo.com/v1/search",

    AIR_QUALITY_API:
        "https://air-quality-api.open-meteo.com/v1/air-quality",

    RADAR_API:
        "https://api.rainviewer.com/public/weather-maps.json",

    DEFAULT_TEMPERATURE_UNIT:
        "celsius",

    DEFAULT_WIND_UNIT:
        "kmh",

    DEFAULT_THEME:
        "system",

    FORECAST_DAYS:
        16,

    RECENT_LIMIT:
        10,

    REQUEST_TIMEOUT:
        15000,

    SEARCH_DEBOUNCE:
        400,

    WEATHER_CACHE_TIME:
        10 * 60 * 1000,

    AIR_CACHE_TIME:
        30 * 60 * 1000,

    DEV_MODE:
        false
};


/* ==========================================================
   2. APPLICATION STATE
========================================================== */

const state = {

    location: null,

    weather: null,

    airQuality: null,

    radar: null,

    loading: false,

    error: null,

    searchLoading: false,

    searchResults: [],

    recentLocations: loadStorage("weatherx_recent", []),

    favorites: loadStorage("weatherx_favorites", []),

    unit:
        loadStorage(
            "weatherx_unit",
            CONFIG.DEFAULT_TEMPERATURE_UNIT
        ),

    windUnit:
        loadStorage(
            "weatherx_wind",
            CONFIG.DEFAULT_WIND_UNIT
        ),

    theme:
        loadStorage(
            "weatherx_theme",
            CONFIG.DEFAULT_THEME
        ),

    animations:
        loadStorage(
            "weatherx_animations",
            true
        ),

    lastUpdated: null,

    lastRequestId: 0,

    map: null,

    radarLayer: null

};


/* ==========================================================
   3. STORAGE HELPERS
========================================================== */

function loadStorage(key, fallback) {

    try {

        const value = localStorage.getItem(key);

        if (value === null) {
            return fallback;
        }

        return JSON.parse(value);

    } catch (error) {

        console.warn("Storage read failed:", key, error);

        return fallback;
    }
}


function saveStorage(key, value) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (error) {

        console.warn("Storage write failed:", key, error);
    }
}


function removeStorage(key) {

    try {

        localStorage.removeItem(key);

    } catch (error) {

        console.warn("Storage removal failed:", key, error);
    }
}


/* ==========================================================
   4. BASIC HELPERS
========================================================== */

function safeNumber(value, fallback = null) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


function safeText(value, fallback = "—") {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    return String(value);
}


function clamp(value, min, max) {

    return Math.min(
        Math.max(value, min),
        max
    );
}


function debounce(callback, delay) {

    let timer;

    return (...args) => {

        clearTimeout(timer);

        timer = setTimeout(
            () => callback(...args),
            delay
        );
    };
}


function createElement(tag, options = {}) {

    const element = document.createElement(tag);

    if (options.className) {
        element.className = options.className;
    }

    if (options.text !== undefined) {
        element.textContent = options.text;
    }

    if (options.id) {
        element.id = options.id;
    }

    return element;
}


/* ==========================================================
   5. HTML SHELL
========================================================== */

function createApplicationShell() {

    const app = document.getElementById("app");

    if (!app) {

        throw new Error(
            'Missing <div id="app"></div>'
        );
    }

    app.innerHTML = `
        <div id="weatherx" class="weatherx">

            <header class="topbar">

                <div class="brand">
                    <div class="brand-logo">W</div>

                    <div>
                        <h1>WeatherX</h1>
                        <span>
                            Understand the sky. Plan your day.
                        </span>
                    </div>
                </div>

                <nav class="desktop-nav">
                    <button data-scroll="dashboard">Home</button>
                    <button data-scroll="forecast">Forecast</button>
                    <button data-scroll="map-section">Map</button>
                    <button data-scroll="air-quality">Air Quality</button>
                    <button data-scroll="locations">Locations</button>
                </nav>

                <div class="header-actions">

                    <button
                        id="unitToggle"
                        class="icon-button"
                        title="Temperature unit"
                    >
                        °C
                    </button>

                    <button
                        id="themeToggle"
                        class="icon-button"
                        title="Change theme"
                    >
                        ◐
                    </button>

                    <button
                        id="locationButton"
                        class="icon-button"
                        title="Use my location"
                    >
                        ◎
                    </button>

                    <button
                        id="refreshButton"
                        class="icon-button"
                        title="Refresh weather"
                    >
                        ↻
                    </button>

                    <button
                        id="settingsButton"
                        class="icon-button"
                        title="Settings"
                    >
                        ⚙
                    </button>

                </div>

            </header>


            <main>

                <section class="search-section">

                    <div class="search-wrapper">

                        <form id="searchForm">

                            <div class="search-box">

                                <span class="search-icon">
                                    ⌕
                                </span>

                                <input
                                    id="searchInput"
                                    autocomplete="off"
                                    placeholder="Search city, region or country..."
                                    aria-label="Search city"
                                >

                                <button
                                    id="searchButton"
                                    type="submit"
                                >
                                    Search
                                </button>

                            </div>

                        </form>

                        <div
                            id="searchResults"
                            class="search-results"
                        ></div>

                    </div>


                    <button
                        id="heroLocationButton"
                        class="location-action"
                    >
                        ◎ Use My Location
                    </button>

                </section>


                <div
                    id="status"
                    class="status"
                    aria-live="polite"
                ></div>


                <section id="dashboard">

                    <div
                        id="weatherHero"
                        class="hero-card glass"
                    >

                        <div class="hero-main">

                            <div>

                                <div
                                    id="locationName"
                                    class="location-name"
                                >
                                    Search for a location
                                </div>

                                <div
                                    id="locationCountry"
                                    class="location-country"
                                >
                                    WeatherX
                                </div>

                                <div
                                    id="localDate"
                                    class="local-date"
                                >
                                    —
                                </div>

                                <div
                                    id="localTime"
                                    class="local-time"
                                >
                                    —
                                </div>

                            </div>


                            <button
                                id="favoriteButton"
                                class="favorite-button"
                                title="Favorite"
                            >
                                ☆
                            </button>

                        </div>


                        <div class="hero-weather">

                            <div
                                id="heroIcon"
                                class="hero-icon"
                            >
                                ☁
                            </div>

                            <div>

                                <div
                                    id="heroTemperature"
                                    class="hero-temperature"
                                >
                                    —
                                </div>

                                <div
                                    id="heroCondition"
                                    class="hero-condition"
                                >
                                    Search for a city
                                </div>

                                <div
                                    id="heroFeelsLike"
                                    class="hero-feels"
                                >
                                    Feels like —
                                </div>

                            </div>

                        </div>


                        <div class="hero-summary">

                            <div>
                                <span>Today's High</span>
                                <strong id="todayHigh">—</strong>
                            </div>

                            <div>
                                <span>Today's Low</span>
                                <strong id="todayLow">—</strong>
                            </div>

                            <div>
                                <span>Rain Chance</span>
                                <strong id="todayRainChance">—</strong>
                            </div>

                        </div>


                        <div
                            id="weatherSummary"
                            class="weather-summary"
                        >
                            Search for a location to see the weather.
                        </div>


                        <div
                            id="updatedAt"
                            class="updated-at"
                        ></div>

                    </section>


                    <section
                        id="metrics"
                        class="metrics-grid"
                    ></section>


                    <section class="section-block">

                        <div class="section-title-row">

                            <div>
                                <h2>Hourly Forecast</h2>
                                <p>Upcoming weather by hour</p>
                            </div>

                        </div>

                        <div
                            id="hourlyForecast"
                            class="hourly-row"
                        ></div>

                    </section>


                    <section class="charts-grid">

                        <article class="chart-card glass">

                            <div class="section-title-row">
                                <div>
                                    <h2>Temperature Trend</h2>
                                    <p>Upcoming hourly temperatures</p>
                                </div>
                            </div>

                            <canvas
                                id="temperatureChart"
                                class="weather-chart"
                            ></canvas>

                        </article>


                        <article class="chart-card glass">

                            <div class="section-title-row">
                                <div>
                                    <h2>Rain Probability</h2>
                                    <p>Expected precipitation chance</p>
                                </div>
                            </div>

                            <canvas
                                id="rainChart"
                                class="weather-chart"
                            ></canvas>

                        </article>


                        <article class="chart-card glass">

                            <div class="section-title-row">
                                <div>
                                    <h2>Wind Trend</h2>
                                    <p>Upcoming wind speed</p>
                                </div>
                            </div>

                            <canvas
                                id="windChart"
                                class="weather-chart"
                            ></canvas>

                        </article>

                    </section>


                    <section
                        id="forecast"
                        class="section-block"
                    >

                        <div class="section-title-row">

                            <div>
                                <h2>Daily Forecast</h2>
                                <p>Extended weather outlook</p>
                            </div>

                        </div>

                        <div
                            id="dailyForecast"
                            class="daily-grid"
                        ></div>

                    </section>


                    <section class="two-column-grid">

                        <article class="glass info-card">

                            <h2>Sunrise & Sunset</h2>

                            <div
                                id="sunInfo"
                                class="sun-info"
                            ></div>

                            <div
                                id="sunProgress"
                                class="sun-progress"
                            >
                                <div
                                    id="sunProgressFill"
                                    class="sun-progress-fill"
                                ></div>
                            </div>

                        </article>


                        <article class="glass info-card">

                            <h2>Weather Insights</h2>

                            <div
                                id="weatherInsights"
                                class="insights"
                            ></div>

                        </article>

                    </section>


                    <section
                        id="air-quality"
                        class="section-block"
                    >

                        <div class="section-title-row">

                            <div>
                                <h2>Air Quality</h2>
                                <p>Current atmospheric conditions</p>
                            </div>

                        </div>

                        <div
                            id="airQualityCard"
                            class="glass air-quality-card"
                        ></div>

                    </section>


                    <section class="two-column-grid">

                        <article class="glass info-card">

                            <h2>Moon</h2>

                            <div
                                id="moonCard"
                                class="moon-card"
                            ></div>

                        </article>


                        <article
                            id="alertsSection"
                            class="glass info-card"
                        >

                            <h2>Weather Alerts</h2>

                            <div
                                id="alertsCard"
                                class="alerts-card"
                            >
                                No alert source configured.
                            </div>

                        </article>

                    </section>


                    <section
                        id="map-section"
                        class="section-block"
                    >

                        <div class="section-title-row">

                            <div>
                                <h2>Weather Map</h2>
                                <p>Location and radar visualization</p>
                            </div>

                            <div class="map-actions">

                                <button id="radarButton">
                                    Radar
                                </button>

                                <button id="mapLocateButton">
                                    Center
                                </button>

                            </div>

                        </div>

                        <div
                            id="weatherMap"
                            class="weather-map glass"
                        ></div>

                        <div class="map-attribution">
                            Map © OpenStreetMap contributors.
                            Radar: RainViewer.
                        </div>

                    </section>


                    <section
                        id="locations"
                        class="section-block"
                    >

                        <div class="two-column-grid">

                            <article class="glass info-card">

                                <div class="section-title-row">

                                    <div>
                                        <h2>Favorites</h2>
                                        <p>Your saved locations</p>
                                    </div>

                                </div>

                                <div
                                    id="favoritesList"
                                    class="location-list"
                                ></div>

                            </article>


                            <article class="glass info-card">

                                <div class="section-title-row">

                                    <div>
                                        <h2>Recent Searches</h2>
                                        <p>Recently opened places</p>
                                    </div>

                                    <button
                                        id="clearRecentButton"
                                        class="small-button"
                                    >
                                        Clear
                                    </button>

                                </div>

                                <div
                                    id="recentList"
                                    class="location-list"
                                ></div>

                            </article>

                        </div>

                    </section>


                    <section class="share-section">

                        <button
                            id="shareButton"
                            class="primary-button"
                        >
                            Share Weather
                        </button>

                        <button
                            id="printButton"
                            class="secondary-button"
                        >
                            Print Forecast
                        </button>

                    </section>

                </section>

            </main>


            <footer>

                <div>
                    <strong>WeatherX</strong>
                    <span>
                        Professional weather dashboard
                    </span>
                </div>

                <div>
                    Weather data by Open-Meteo
                </div>

                <div>
                    Radar data by RainViewer
                </div>

            </footer>


            <div
                id="modal"
                class="modal hidden"
                role="dialog"
                aria-modal="true"
            >

                <div class="modal-content glass">

                    <button
                        id="closeModal"
                        class="modal-close"
                    >
                        ×
                    </button>

                    <div id="modalBody"></div>

                </div>

            </div>

        </div>
    `;

}


/* ==========================================================
   6. CSS
========================================================== */

function createStyles() {

    const style = document.createElement("style");

    style.textContent = `

    :root {

        --bg:
            #07111f;

        --surface:
            rgba(255,255,255,.10);

        --surface-strong:
            rgba(255,255,255,.14);

        --border:
            rgba(255,255,255,.15);

        --text:
            #f8fafc;

        --muted:
            #b7c4d4;

        --accent:
            #7dd3fc;

        --accent-2:
            #a78bfa;

        --danger:
            #fb7185;

        --success:
            #4ade80;

        --shadow:
            0 25px 70px rgba(0,0,0,.25);

        --radius:
            24px;

        --max-width:
            1400px;
    }


    * {
        box-sizing: border-box;
    }


    html {
        scroll-behavior: smooth;
    }


    body {

        margin: 0;

        min-height: 100vh;

        font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

        color: var(--text);

        background:
            radial-gradient(
                circle at top left,
                #18334e,
                transparent 35%
            ),
            linear-gradient(
                135deg,
                #06101c,
                #0d1b2d
            );

        transition:
            background .5s ease,
            color .3s ease;
    }


    body.light-mode {

        --bg:
            #e9f4ff;

        --surface:
            rgba(255,255,255,.68);

        --surface-strong:
            rgba(255,255,255,.84);

        --border:
            rgba(25,45,70,.10);

        --text:
            #102033;

        --muted:
            #536579;

        background:
            linear-gradient(
                135deg,
                #dff2ff,
                #f8fbff
            );
    }


    body.weather-clear {
        background:
            radial-gradient(
                circle at 20% 10%,
                rgba(255,214,102,.28),
                transparent 30%
            ),
            linear-gradient(
                135deg,
                #0c3c63,
                #10253d
            );
    }


    body.weather-rain {
        background:
            linear-gradient(
                135deg,
                #10283d,
                #172d40,
                #091623
            );
    }


    body.weather-storm {
        background:
            linear-gradient(
                135deg,
                #111827,
                #172033,
                #090d18
            );
    }


    body.weather-snow {
        background:
            linear-gradient(
                135deg,
                #193552,
                #284865,
                #0e2032
            );
    }


    body.weather-fog {
        background:
            linear-gradient(
                135deg,
                #334155,
                #475569,
                #1e293b
            );
    }


    .weatherx {

        width: 100%;

        min-height: 100vh;
    }


    .topbar {

        position: sticky;

        top: 0;

        z-index: 1000;

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: 20px;

        padding:
            16px
            clamp(16px, 4vw, 60px);

        background:
            rgba(5,12,22,.60);

        backdrop-filter:
            blur(20px);

        border-bottom:
            1px solid var(--border);
    }


    body.light-mode .topbar {
        background:
            rgba(255,255,255,.72);
    }


    .brand {

        display: flex;

        align-items: center;

        gap: 12px;

        min-width: max-content;
    }


    .brand-logo {

        width: 42px;

        height: 42px;

        display: grid;

        place-items: center;

        border-radius: 14px;

        font-weight: 900;

        background:
            linear-gradient(
                135deg,
                var(--accent),
                var(--accent-2)
            );

        color: #06111e;

        box-shadow:
            0 10px 30px rgba(125,211,252,.25);
    }


    .brand h1 {

        margin: 0;

        font-size: 19px;
    }


    .brand span {

        display: block;

        margin-top: 2px;

        color: var(--muted);

        font-size: 11px;
    }


    .desktop-nav {

        display: flex;

        gap: 6px;

        align-items: center;
    }


    .desktop-nav button,
    .header-actions button,
    .map-actions button {

        border: 0;

        background: transparent;

        color: var(--text);

        cursor: pointer;
    }


    .desktop-nav button {

        padding: 9px 12px;

        border-radius: 11px;
    }


    .desktop-nav button:hover {

        background: var(--surface);

    }


    .header-actions {

        display: flex;

        gap: 6px;

        align-items: center;
    }


    .icon-button {

        width: 40px;

        height: 40px;

        border-radius: 12px;

        background: var(--surface) !important;

        border:
            1px solid var(--border) !important;

        transition:
            transform .2s ease,
            background .2s ease;
    }


    .icon-button:hover {

        transform: translateY(-2px);

        background:
            var(--surface-strong) !important;
    }


    main {

        width: min(
            calc(100% - 32px),
            var(--max-width)
        );

        margin: 0 auto;

        padding: 34px 0 60px;
    }


    .search-section {

        display: flex;

        gap: 12px;

        margin-bottom: 20px;
    }


    .search-wrapper {

        position: relative;

        flex: 1;
    }


    .search-box {

        display: flex;

        align-items: center;

        gap: 10px;

        padding: 7px;

        border:
            1px solid var(--border);

        border-radius: 18px;

        background: var(--surface);

        backdrop-filter:
            blur(18px);

        box-shadow:
            var(--shadow);
    }


    .search-icon {

        padding-left: 12px;

        font-size: 25px;
    }


    .search-box input {

        flex: 1;

        min-width: 0;

        border: 0;

        outline: 0;

        background: transparent;

        color: var(--text);

        font-size: 16px;

        padding: 13px 4px;
    }


    .search-box input::placeholder {

        color: var(--muted);
    }


    .search-box button,
    .location-action,
    .primary-button {

        border: 0;

        cursor: pointer;

        font-weight: 800;

        border-radius: 13px;

        padding: 12px 17px;

        color: #06111e;

        background:
            linear-gradient(
                135deg,
                var(--accent),
                #c4b5fd
            );

        transition:
            transform .2s ease,
            box-shadow .2s ease;
    }


    .search-box button:hover,
    .location-action:hover,
    .primary-button:hover {

        transform: translateY(-2px);

        box-shadow:
            0 12px 28px
            rgba(125,211,252,.2);
    }


    .location-action {

        white-space: nowrap;
    }


    .search-results {

        position: absolute;

        width: 100%;

        top: calc(100% + 8px);

        z-index: 100;

        display: none;

        overflow: hidden;

        border:
            1px solid var(--border);

        border-radius: 17px;

        background:
            rgba(8,17,30,.95);

        backdrop-filter:
            blur(20px);

        box-shadow:
            var(--shadow);
    }


    body.light-mode .search-results {
        background:
            rgba(255,255,255,.98);
    }


    .search-results.visible {
        display: block;
    }


    .search-result {

        width: 100%;

        display: block;

        border: 0;

        text-align: left;

        background: transparent;

        color: var(--text);

        padding: 14px;

        cursor: pointer;
    }


    .search-result:hover {

        background: var(--surface);
    }


    .search-result strong {

        display: block;
    }


    .search-result span {

        display: block;

        color: var(--muted);

        font-size: 12px;

        margin-top: 3px;
    }


    .status {

        min-height: 24px;

        color: var(--muted);

        font-size: 14px;

        margin: 10px 2px 16px;
    }


    .glass {

        background:
            var(--surface);

        border:
            1px solid var(--border);

        backdrop-filter:
            blur(18px);

        box-shadow:
            var(--shadow);
    }


    .hero-card {

        padding:
            clamp(22px, 4vw, 40px);

        border-radius:
            clamp(24px, 3vw, 34px);

        overflow: hidden;
    }


    .hero-main {

        display: flex;

        justify-content: space-between;

        gap: 20px;
    }


    .location-name {

        font-size:
            clamp(24px, 4vw, 46px);

        font-weight: 900;

        letter-spacing:
            -.04em;
    }


    .location-country {

        color: var(--muted);

        margin-top: 3px;
    }


    .local-date {

        margin-top: 18px;

        font-weight: 700;
    }


    .local-time {

        margin-top: 3px;

        color: var(--accent);

        font-size: 14px;
    }


    .favorite-button {

        width: 50px;

        height: 50px;

        border-radius: 15px;

        border:
            1px solid var(--border);

        background: var(--surface);

        color: #facc15;

        font-size: 25px;

        cursor: pointer;
    }


    .hero-weather {

        display: flex;

        align-items: center;

        gap: 30px;

        padding: 35px 0;
    }


    .hero-icon {

        font-size:
            clamp(70px, 12vw, 130px);

        line-height: 1;

        filter:
            drop-shadow(
                0 15px 25px
                rgba(0,0,0,.22)
            );
    }


    .hero-temperature {

        font-size:
            clamp(70px, 12vw, 140px);

        line-height: .9;

        font-weight: 900;

        letter-spacing:
            -.08em;
    }


    .hero-condition {

        margin-top: 15px;

        font-size: 21px;

        font-weight: 800;
    }


    .hero-feels {

        margin-top: 7px;

        color: var(--muted);
    }


    .hero-summary {

        display: grid;

        grid-template-columns:
            repeat(3, 1fr);

        gap: 10px;

        border-top:
            1px solid var(--border);

        padding-top: 18px;
    }


    .hero-summary div {

        padding: 10px;

        border-radius: 15px;

        background:
            rgba(255,255,255,.04);
    }


    .hero-summary span {

        display: block;

        font-size: 12px;

        color: var(--muted);
    }


    .hero-summary strong {

        display: block;

        margin-top: 4px;

        font-size: 19px;
    }


    .weather-summary {

        margin-top: 18px;

        line-height: 1.7;

        color: var(--muted);
    }


    .updated-at {

        margin-top: 13px;

        color: var(--muted);

        font-size: 12px;
    }


    .metrics-grid {

        display: grid;

        grid-template-columns:
            repeat(4, 1fr);

        gap: 14px;

        margin-top: 18px;
    }


    .metric-card {

        min-height: 145px;

        padding: 20px;

        border-radius: 20px;
    }


    .metric-icon {

        font-size: 25px;
    }


    .metric-label {

        margin-top: 14px;

        color: var(--muted);

        font-size: 13px;
    }


    .metric-value {

        margin-top: 5px;

        font-size: 25px;

        font-weight: 900;
    }


    .metric-note {

        margin-top: 4px;

        font-size: 11px;

        color: var(--muted);
    }


    .section-block {

        margin-top: 30px;
    }


    .section-title-row {

        display: flex;

        justify-content: space-between;

        gap: 15px;

        align-items: center;

        margin-bottom: 15px;
    }


    .section-title-row h2,
    .info-card h2 {

        margin: 0;

        font-size: 19px;
    }


    .section-title-row p {

        margin: 4px 0 0;

        color: var(--muted);

        font-size: 12px;
    }


    .hourly-row {

        display: flex;

        overflow-x: auto;

        gap: 12px;

        padding-bottom: 7px;

        scrollbar-width: thin;
    }


    .hour-card {

        min-width: 125px;

        padding: 17px;

        border-radius: 19px;

        flex: 0 0 auto;

        text-align: center;
    }


    .hour-card.active {

        border-color:
            rgba(125,211,252,.7);

        box-shadow:
            0 0 0 1px rgba(125,211,252,.25),
            0 15px 35px rgba(0,0,0,.2);
    }


    .hour-time {

        color: var(--muted);

        font-size: 12px;
    }


    .hour-icon {

        margin: 13px 0;

        font-size: 38px;
    }


    .hour-temp {

        font-size: 24px;

        font-weight: 900;
    }


    .hour-rain {

        margin-top: 7px;

        color: var(--accent);
        
        font-size: 12px;
    }


    .charts-grid {

        display: grid;

        grid-template-columns:
            repeat(3, 1fr);

        gap: 14px;

        margin-top: 30px;
    }


    .chart-card {

        padding: 20px;

        border-radius: 22px;
    }


    .weather-chart {

        width: 100%;

        height: 230px;

        display: block;

        margin-top: 10px;
    }


    .daily-grid {

        display: grid;

        grid-template-columns:
            repeat(4, 1fr);

        gap: 12px;
    }


    .daily-card {

        padding: 18px;

        border-radius: 20px;
    }


    .daily-card.today {

        border-color:
            rgba(125,211,252,.6);

        box-shadow:
            0 12px 35px
            rgba(125,211,252,.12);
    }


    .daily-day {

        font-weight: 800;
    }


    .daily-date {

        margin-top: 3px;

        font-size: 12px;

        color: var(--muted);
    }


    .daily-icon {

        font-size: 40px;

        margin: 15px 0;
    }


    .daily-condition {

        min-height: 35px;

        font-size: 12px;

        color: var(--muted);
    }


    .daily-temp {

        display: flex;

        justify-content: space-between;

        margin-top: 14px;

        font-weight: 900;
    }


    .daily-rain {

        margin-top: 10px;

        color: var(--accent);

        font-size: 12px;
    }


    .two-column-grid {

        display: grid;

        grid-template-columns:
            repeat(2, 1fr);

        gap: 14px;

        margin-top: 30px;
    }


    .info-card {

        padding: 22px;

        border-radius: 22px;
    }


    .sun-info {

        display: grid;

        grid-template-columns:
            repeat(2, 1fr);

        gap: 15px;

        margin-top: 20px;
    }


    .sun-item {

        padding: 17px;

        background:
            rgba(255,255,255,.05);

        border-radius: 15px;
    }


    .sun-item span {

        display: block;

        color: var(--muted);

        font-size: 12px;
    }


    .sun-item strong {

        display: block;

        margin-top: 6px;

        font-size: 20px;
    }


    .sun-progress {

        height: 13px;

        margin-top: 22px;

        overflow: hidden;

        border-radius: 100px;

        background:
            rgba(255,255,255,.08);
    }


    .sun-progress-fill {

        width: 0%;

        height: 100%;

        background:
            linear-gradient(
                90deg,
                #fbbf24,
                #fde68a
            );

        transition:
            width .5s ease;
    }


    .insights {

        display: grid;

        gap: 10px;

        margin-top: 18px;
    }


    .insight {

        padding: 13px;

        border-radius: 14px;

        background:
            rgba(255,255,255,.05);

        color: var(--muted);

        line-height: 1.5;
    }


    .air-quality-card {

        padding: 24px;

        border-radius: 22px;
    }


    .aqi-main {

        display: flex;

        align-items: center;

        gap: 20px;
    }


    .aqi-number {

        font-size: 55px;

        font-weight: 900;
    }


    .aqi-category {

        font-size: 18px;

        font-weight: 800;
    }


    .aqi-source {

        margin-top: 5px;

        font-size: 12px;

        color: var(--muted);
    }


    .aqi-metrics {

        display: grid;

        grid-template-columns:
            repeat(4,1fr);

        gap: 10px;

        margin-top: 20px;
    }


    .aqi-metric {

        padding: 13px;

        border-radius: 14px;

        background:
            rgba(255,255,255,.05);
    }


    .aqi-metric span {

        display: block;

        color: var(--muted);

        font-size: 11px;
    }


    .aqi-metric strong {

        display: block;

        margin-top: 4px;
    }


    .moon-card {

        margin-top: 18px;

        min-height: 160px;

        display: grid;

        place-items: center;

        text-align: center;
    }


    .moon-icon {

        font-size: 75px;
    }


    .moon-phase {

        margin-top: 10px;

        font-weight: 800;
    }


    .moon-note {

        margin-top: 5px;

        color: var(--muted);

        font-size: 12px;
    }


    .alerts-card {

        margin-top: 18px;

        color: var(--muted);

        line-height: 1.6;
    }


    .weather-map {

        height: 500px;

        overflow: hidden;

        border-radius: 22px;
    }


    .map-actions {

        display: flex;

        gap: 7px;
    }


    .map-actions button,
    .small-button {

        padding: 9px 12px;

        border-radius: 10px;

        background:
            var(--surface);

        border:
            1px solid var(--border);

        color: var(--text);

        cursor: pointer;
    }


    .map-attribution {

        margin-top: 8px;

        color: var(--muted);

        font-size: 11px;
    }


    .location-list {

        display: grid;

        gap: 10px;

        margin-top: 15px;
    }


    .location-item {

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: 10px;

        padding: 13px;

        border-radius: 15px;

        background:
            rgba(255,255,255,.05);
    }


    .location-item-main {

        min-width: 0;
    }


    .location-item-main strong {

        display: block;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;
    }


    .location-item-main span {

        display: block;

        margin-top: 2px;

        color: var(--muted);

        font-size: 11px;
    }


    .location-item-actions {

        display: flex;

        gap: 5px;
    }


    .location-item-actions button {

        border:
            1px solid var(--border);

        background:
            transparent;

        color: var(--text);

        border-radius: 9px;

        padding: 7px 9px;

        cursor: pointer;
    }


    .share-section {

        display: flex;

        justify-content: center;

        gap: 10px;

        margin-top: 30px;
    }


    .secondary-button {

        padding: 12px 17px;

        border-radius: 13px;

        cursor: pointer;

        border:
            1px solid var(--border);

        background:
            var(--surface);

        color: var(--text);

        font-weight: 800;
    }


    footer {

        display: flex;

        justify-content: space-between;

        gap: 20px;

        max-width: var(--max-width);

        margin: auto;

        padding:
            35px 16px 50px;

        color: var(--muted);

        font-size: 12px;

        border-top:
            1px solid var(--border);
    }


    footer strong {

        display: block;

        color: var(--text);

        font-size: 15px;
    }


    footer span {

        display: block;

        margin-top: 3px;
    }


    .modal {

        position: fixed;

        inset: 0;

        z-index: 2000;

        display: grid;

        place-items: center;

        padding: 20px;

        background:
            rgba(0,0,0,.65);

        backdrop-filter:
            blur(7px);
    }


    .modal.hidden {
        display: none;
    }


    .modal-content {

        position: relative;

        width: min(
            700px,
            100%
        );

        max-height: 85vh;

        overflow: auto;

        padding: 28px;

        border-radius: 25px;
    }


    .modal-close {

        position: absolute;

        top: 15px;

        right: 15px;

        width: 38px;

        height: 38px;

        border-radius: 11px;

        border:
            1px solid var(--border);

        background: var(--surface);

        color: var(--text);

        cursor: pointer;

        font-size: 20px;
    }


    .loading {

        opacity: .65;

        pointer-events: none;
    }


    .spin {

        animation:
            spin .8s linear infinite;
    }


    @keyframes spin {

        to {
            transform: rotate(360deg);
        }

    }


    .fade-in {

        animation:
            fadeIn .4s ease both;
    }


    @keyframes fadeIn {

        from {
            opacity: 0;
            transform: translateY(8px);
        }

        to {
            opacity: 1;
            transform: translateY(0);
        }

    }


    @media (
        prefers-reduced-motion: reduce
    ) {

        *,
        *::before,
        *::after {

            animation-duration: .01ms !important;

            animation-iteration-count: 1 !important;

            scroll-behavior: auto !important;

            transition-duration: .01ms !important;
        }

    }


    @media (max-width: 1100px) {

        .desktop-nav {
            display: none;
        }

        .metrics-grid {
            grid-template-columns:
                repeat(2,1fr);
        }

        .charts-grid {
            grid-template-columns:
                1fr;
        }

        .daily-grid {
            grid-template-columns:
                repeat(4,1fr);
        }

    }


    @media (max-width: 760px) {

        main {
            width: min(
                calc(100% - 20px),
                var(--max-width)
            );
        }

        .topbar {
            padding: 12px 10px;
        }

        .brand span {
            display: none;
        }

        .header-actions {
            gap: 4px;
        }

        .icon-button {
            width: 36px;
            height: 36px;
        }

        .search-section {
            flex-direction: column;
        }

        .location-action {
            width: 100%;
        }

        .hero-weather {
            gap: 18px;
        }

        .hero-temperature {
            font-size: 75px;
        }

        .hero-icon {
            font-size: 75px;
        }

        .hero-summary {
            grid-template-columns:
                1fr;
        }

        .metrics-grid {
            grid-template-columns:
                repeat(2,1fr);
        }

        .two-column-grid {
            grid-template-columns:
                1fr;
        }

        .daily-grid {
            grid-template-columns:
                repeat(2,1fr);
        }

        .aqi-metrics {
            grid-template-columns:
                repeat(2,1fr);
        }

        .share-section {
            flex-direction: column;
        }

        .share-section button {
            width: 100%;
        }

        .weather-map {
            height: 390px;
        }

        footer {
            flex-direction: column;
        }

    }


    @media (max-width: 420px) {

        .location-name {
            font-size: 28px;
        }

        .hero-weather {
            align-items: flex-start;
        }

        .hero-temperature {
            font-size: 62px;
        }

        .metrics-grid {
            grid-template-columns:
                1fr 1fr;
        }

        .metric-card {
            padding: 14px;
            min-height: 125px;
        }

        .daily-grid {
            grid-template-columns:
                1fr;
        }

    }

    `;

    document.head.appendChild(style);
}


/* ==========================================================
   7. DOM REFERENCES
========================================================== */

const elements = {};


function cacheElements() {

    const ids = [

        "searchForm",
        "searchInput",
        "searchButton",
        "searchResults",
        "heroLocationButton",
        "status",

        "weatherHero",
        "locationName",
        "locationCountry",
        "localDate",
        "localTime",

        "favoriteButton",
        "heroIcon",
        "heroTemperature",
        "heroCondition",
        "heroFeelsLike",

        "todayHigh",
        "todayLow",
        "todayRainChance",

        "weatherSummary",
        "updatedAt",

        "metrics",
        "hourlyForecast",

        "temperatureChart",
        "rainChart",
        "windChart",

        "dailyForecast",

        "sunInfo",
        "sunProgressFill",

        "weatherInsights",

        "airQualityCard",

        "moonCard",
        "alertsCard",

        "weatherMap",

        "radarButton",
        "mapLocateButton",

        "favoritesList",
        "recentList",
        "clearRecentButton",

        "shareButton",
        "printButton",

        "unitToggle",
        "themeToggle",
        "locationButton",
        "refreshButton",
        "settingsButton",

        "modal",
        "modalBody",
        "closeModal"

    ];

    ids.forEach(id => {

        elements[id] =
            document.getElementById(id);
    });

}


/* ==========================================================
   8. WEATHER CODE ENGINE
========================================================== */

const WEATHER_CODES = {

    0: {
        text: "Clear Sky",
        iconDay: "☀️",
        iconNight: "🌙",
        theme: "clear"
    },

    1: {
        text: "Mainly Clear",
        iconDay: "🌤️",
        iconNight: "🌙",
        theme: "clear"
    },

    2: {
        text: "Partly Cloudy",
        iconDay: "⛅",
        iconNight: "☾",
        theme: "clear"
    },

    3: {
        text: "Overcast",
        iconDay: "☁️",
        iconNight: "☁️",
        theme: "cloudy"
    },

    45: {
        text: "Fog",
        iconDay: "🌫️",
        iconNight: "🌫️",
        theme: "fog"
    },

    48: {
        text: "Rime Fog",
        iconDay: "🌫️",
        iconNight: "🌫️",
        theme: "fog"
    },

    51: {
        text: "Light Drizzle",
        iconDay: "🌦️",
        iconNight: "🌧️",
        theme: "rain"
    },

    53: {
        text: "Moderate Drizzle",
        iconDay: "🌦️",
        iconNight: "🌧️",
        theme: "rain"
    },

    55: {
        text: "Dense Drizzle",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "rain"
    },

    56: {
        text: "Light Freezing Drizzle",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "rain"
    },

    57: {
        text: "Dense Freezing Drizzle",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "rain"
    },

    61: {
        text: "Slight Rain",
        iconDay: "🌦️",
        iconNight: "🌧️",
        theme: "rain"
    },

    63: {
        text: "Moderate Rain",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "rain"
    },

    65: {
        text: "Heavy Rain",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "rain"
    },

    66: {
        text: "Light Freezing Rain",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "rain"
    },

    67: {
        text: "Heavy Freezing Rain",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "rain"
    },

    71: {
        text: "Slight Snow",
        iconDay: "🌨️",
        iconNight: "🌨️",
        theme: "snow"
    },

    73: {
        text: "Moderate Snow",
        iconDay: "❄️",
        iconNight: "❄️",
        theme: "snow"
    },

    75: {
        text: "Heavy Snow",
        iconDay: "❄️",
        iconNight: "❄️",
        theme: "snow"
    },

    77: {
        text: "Snow Grains",
        iconDay: "❄️",
        iconNight: "❄️",
        theme: "snow"
    },

    80: {
        text: "Slight Rain Showers",
        iconDay: "🌦️",
        iconNight: "🌧️",
        theme: "rain"
    },

    81: {
        text: "Moderate Rain Showers",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "rain"
    },

    82: {
        text: "Violent Rain Showers",
        iconDay: "🌧️",
        iconNight: "🌧️",
        theme: "storm"
    },

    85: {
        text: "Slight Snow Showers",
        iconDay: "🌨️",
        iconNight: "🌨️",
        theme: "snow"
    },

    86: {
        text: "Heavy Snow Showers",
        iconDay: "❄️",
        iconNight: "❄️",
        theme: "snow"
    },

    95: {
        text: "Thunderstorm",
        iconDay: "⛈️",
        iconNight: "⛈️",
        theme: "storm"
    },

    96: {
        text: "Thunderstorm With Hail",
        iconDay: "⛈️",
        iconNight: "⛈️",
        theme: "storm"
    },

    97: {
        text: "Heavy Thunderstorm",
        iconDay: "⛈️",
        iconNight: "⛈️",
        theme: "storm"
    },

    98: {
        text: "Thunderstorm",
        iconDay: "⛈️",
        iconNight: "⛈️",
        theme: "storm"
    },

    99: {
        text: "Thunderstorm With Heavy Hail",
        iconDay: "⛈️",
        iconNight: "⛈️",
        theme: "storm"
    }

};


function getWeatherMeta(code, isDay = true) {

    const meta =
        WEATHER_CODES[code] ||
        {
            text: "Unknown Conditions",
            iconDay: "🌤️",
            iconNight: "🌙",
            theme: "cloudy"
        };

    return {

        text: meta.text,

        icon:
            isDay
                ? meta.iconDay
                : meta.iconNight,

        theme: meta.theme

    };
}


/* ==========================================================
   9. UNIT CONVERSION
========================================================== */

function formatTemperature(value) {

    const number = safeNumber(value);

    if (number === null) {
        return "—";
    }

    const rounded =
        Math.round(number);

    return `${rounded}°`;
}


function formatSpeed(value) {

    const number = safeNumber(value);

    if (number === null) {
        return "—";
    }

    return `${number.toFixed(1)} ${getWindUnitLabel()}`;
}


function getWindUnitLabel() {

    switch (state.windUnit) {

        case "mph":
            return "mph";

        case "ms":
            return "m/s";

        case "kn":
            return "kn";

        default:
            return "km/h";
    }
}


/* ==========================================================
   10. WIND DIRECTION
========================================================== */

function degreesToCompass(degrees) {

    const value =
        safeNumber(degrees);

    if (value === null) {
        return "—";
    }

    const directions = [

        "N",
        "NE",
        "E",
        "SE",
        "S",
        "SW",
        "W",
        "NW"

    ];

    const normalized =
        ((value % 360) + 360) % 360;

    const index =
        Math.round(normalized / 45) % 8;

    return directions[index];
}


/* ==========================================================
   11. DATE / TIME
========================================================== */

function parseApiDate(value) {

    if (!value) {
        return null;
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date;
}


function formatHour(value) {

    const date =
        parseApiDate(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            hour: "numeric",
            minute: "2-digit"
        }
    ).format(date);
}


function formatDate(value) {

    const date =
        parseApiDate(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    ).format(date);
}


function formatShortDate(value) {

    const date =
        parseApiDate(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            month: "short",
            day: "numeric"
        }
    ).format(date);
}


/* ==========================================================
   12. API FETCH HELPER
========================================================== */

async function fetchJSON(
    url,
    timeout = CONFIG.REQUEST_TIMEOUT
) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {

        const response =
            await fetch(
                url,
                {
                    signal:
                        controller.signal
                }
            );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }

        return await response.json();

    } finally {

        clearTimeout(timer);
    }
}


/* ==========================================================
   13. GEOCODING
========================================================== */

async function searchLocations(
    query,
    signal = null
) {

    const params =
        new URLSearchParams({

            name: query,

            count: "10",

            language: "en",

            format: "json"

        });

    const controller =
        signal ||
        new AbortController();

    const url =
        `${CONFIG.GEOCODING_API}?${params}`;

    const response =
        await fetch(
            url,
            {
                signal:
                    controller.signal
            }
        );

    if (!response.ok) {

        throw new Error(
            `Geocoding failed: ${response.status}`
        );
    }

    const data =
        await response.json();

    return Array.isArray(data.results)
        ? data.results
        : [];
}


/* ==========================================================
   14. WEATHER API
========================================================== */

async function getWeather(
    latitude,
    longitude,
    requestId
) {

    const hourly = [

        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "cloud_cover",
        "visibility",
        "pressure_msl",
        "dew_point_2m"

    ].join(",");


    const current = [

        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "cloud_cover",
        "is_day",
        "pressure_msl",
        "visibility",
        "dew_point_2m",
        "uv_index"

    ].join(",");


    const daily = [

        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
        "precipitation_sum",
        "sunrise",
        "sunset",
        "daylight_duration",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
        "wind_direction_10m_dominant",
        "uv_index_max"

    ].join(",");


    const params =
        new URLSearchParams({

            latitude:
                String(latitude),

            longitude:
                String(longitude),

            current,

            hourly,

            daily,

            forecast_days:
                String(CONFIG.FORECAST_DAYS),

            temperature_unit:
                state.unit,

            wind_speed_unit:
                state.windUnit,

            precipitation_unit:
                "mm",

            timezone:
                "auto"

        });


    const url =
        `${CONFIG.WEATHER_API}?${params}`;


    const response =
        await fetchJSON(url);


    if (
        requestId !== state.lastRequestId
    ) {

        return null;
    }


    return response;
}


/* ==========================================================
   15. AIR QUALITY
========================================================== */

async function getAirQuality(
    latitude,
    longitude
) {

    const params =
        new URLSearchParams({

            latitude:
                String(latitude),

            longitude:
                String(longitude),

            current:
                [
                    "european_aqi",
                    "us_aqi",
                    "pm10",
                    "pm2_5",
                    "carbon_monoxide",
                    "nitrogen_dioxide",
                    "sulphur_dioxide",
                    "ozone",
                    "uv_index"
                ].join(","),

            hourly:
                [
                    "european_aqi",
                    "us_aqi",
                    "pm10",
                    "pm2_5"
                ].join(","),

            forecast_days:
                "5",

            timezone:
                "auto"

        });


    const url =
        `${CONFIG.AIR_QUALITY_API}?${params}`;


    return fetchJSON(url);
}


/* ==========================================================
   16. WEATHER CACHE
========================================================== */

function getWeatherCacheKey(
    latitude,
    longitude
) {

    return `
        weatherx_weather_
        ${Number(latitude).toFixed(3)}_
        ${Number(longitude).toFixed(3)}
    `.replace(/\s+/g, "");
}


function saveWeatherCache(
    latitude,
    longitude,
    weather
) {

    const item = {

        timestamp:
            Date.now(),

        weather

    };

    saveStorage(
        getWeatherCacheKey(
            latitude,
            longitude
        ),
        item
    );
}


function getWeatherCache(
    latitude,
    longitude
) {

    const item =
        loadStorage(
            getWeatherCacheKey(
                latitude,
                longitude
            ),
            null
        );

    if (!item) {
        return null;
    }

    if (
        Date.now() -
        item.timestamp >
        CONFIG.WEATHER_CACHE_TIME
    ) {

        return null;
    }

    return item.weather;
}


/* ==========================================================
   17. LOCATION STATE
========================================================== */

function setLocation(location) {

    state.location = {

        name:
            location.name,

        region:
            location.admin1 || "",

        country:
            location.country || "",

        countryCode:
            location.country_code || "",

        latitude:
            Number(location.latitude),

        longitude:
            Number(location.longitude),

        timezone:
            location.timezone || ""

    };
}


/* ==========================================================
   18. LOAD LOCATION
========================================================== */

async function loadLocation(
    location,
    options = {}
) {

    const {

        showCached = true,

        addHistory = true

    } = options;


    const requestId =
        ++state.lastRequestId;


    state.error = null;

    state.loading = true;

    setLoading(true);

    setStatus(
        "Loading weather..."
    );


    setLocation(location);

    updateFavoriteButton();


    try {

        let weather = null;


        if (showCached) {

            weather =
                getWeatherCache(
                    location.latitude,
                    location.longitude
                );

            if (weather) {

                console.log(
                    "Using fresh local cache."
                );
            }
        }


        if (!weather) {

            weather =
                await getWeather(
                    location.latitude,
                    location.longitude,
                    requestId
                );

            if (
                requestId !==
                state.lastRequestId
            ) {
                return;
            }

            saveWeatherCache(
                location.latitude,
                location.longitude,
                weather
            );
        }


        state.weather =
            weather;


        state.lastUpdated =
            Date.now();


        if (addHistory) {

            saveRecentLocation(
                state.location
            );
        }


        renderAll();


        setStatus(
            "Weather loaded successfully."
        );


        try {

            state.airQuality =
                await getAirQuality(
                    location.latitude,
                    location.longitude
                );

        } catch (airError) {

            console.warn(
                "Air quality unavailable:",
                airError
            );

            state.airQuality = null;
        }


        renderAirQuality();


        await initializeMap();


    } catch (error) {

        console.error(
            "Weather loading error:",
            error
        );


        state.error =
            friendlyError(
                error
            );


        setStatus(
            state.error
        );

    } finally {

        state.loading = false;

        setLoading(false);

    }

}


/* ==========================================================
   19. FRIENDLY ERROR
========================================================== */

function friendlyError(error) {

    if (
        error?.name ===
        "AbortError"
    ) {

        return "The request timed out. Please try again.";
    }


    if (
        !navigator.onLine
    ) {

        return "You appear to be offline. Please check your internet connection.";
    }


    const message =
        String(
            error?.message || ""
        );


    if (
        message.includes("404")
    ) {

        return "The requested weather service could not be found.";
    }


    if (
        message.includes("429")
    ) {

        return "Too many requests were made. Please try again shortly.";
    }


    return "We couldn't load the weather right now. Please try again.";
}


/* ==========================================================
   20. LOADING UI
========================================================== */

function setLoading(isLoading) {

    document.body.classList.toggle(
        "loading",
        isLoading
    );


    if (elements.searchButton) {

        elements.searchButton.disabled =
            isLoading;

        elements.searchButton.textContent =
            isLoading
                ? "Loading..."
                : "Search";
    }


    if (elements.refreshButton) {

        elements.refreshButton.classList.toggle(
            "spin",
            isLoading
        );
    }

}


/* ==========================================================
   21. STATUS
========================================================== */

function setStatus(message) {

    if (
        elements.status
    ) {

        elements.status.textContent =
            message || "";
    }

}


/* ==========================================================
   22. RENDER EVERYTHING
========================================================== */

function renderAll() {

    renderCurrentWeather();

    renderMetrics();

    renderHourly();

    renderDaily();

    renderSun();

    renderInsights();

    renderMoon();

    renderHistory();

    renderFavorites();

    updateWeatherTheme();

    updateUnitButton();

    updateThemeButton();

    drawAllCharts();

    updateUpdatedTime();

}


/* ==========================================================
   23. CURRENT WEATHER
========================================================== */

function renderCurrentWeather() {

    if (
        !state.location ||
        !state.weather?.current
    ) {

        return;
    }


    const current =
        state.weather.current;

    const daily =
        state.weather.daily;


    const code =
        safeNumber(
            current.weather_code
        );


    const meta =
        getWeatherMeta(
            code,
            Boolean(current.is_day)
        );


    elements.locationName.textContent =
        state.location.name;


    elements.locationCountry.textContent =
        [
            state.location.region,
            state.location.country
        ]
        .filter(Boolean)
        .join(", ");


    elements.localDate.textContent =
        formatDate(
            current.time
        );


    elements.localTime.textContent =
        `${formatHour(current.time)} ${
            state.location.timezone
                ? `· ${state.location.timezone}`
                : ""
        }`;


    elements.heroIcon.textContent =
        meta.icon;


    elements.heroTemperature.textContent =
        formatTemperature(
            current.temperature_2m
        );


    elements.heroCondition.textContent =
        meta.text;


    elements.heroFeelsLike.textContent =
        `Feels like ${formatTemperature(
            current.apparent_temperature
        )}`;


    elements.todayHigh.textContent =
        formatTemperature(
            daily?.temperature_2m_max?.[0]
        );


    elements.todayLow.textContent =
        formatTemperature(
            daily?.temperature_2m_min?.[0]
        );


    elements.todayRainChance.textContent =
        `${safeNumber(
            daily?.precipitation_probability_max?.[0]
        ) ?? "—"}%`;


    elements.weatherSummary.textContent =
        buildWeatherSummary(
            current,
            daily,
            meta.text
        );


    elements.weatherHero.classList.add(
        "fade-in"
    );


    updateFavoriteButton();

}


/* ==========================================================
   24. WEATHER SUMMARY
========================================================== */

function buildWeatherSummary(
    current,
    daily,
    condition
) {

    const temp =
        formatTemperature(
            current.temperature_2m
        );


    const humidity =
        safeNumber(
            current.relative_humidity_2m
        );


    const wind =
        safeNumber(
            current.wind_speed_10m
        );


    const direction =
        degreesToCompass(
            current.wind_direction_10m
        );


    const rain =
        safeNumber(
            daily?.precipitation_probability_max?.[0]
        );


    return `Currently ${temp} with ${condition.toLowerCase()}. ` +
        `Humidity is ${humidity ?? "—"}% and winds are ` +
        `${formatSpeed(wind)} from the ${direction}. ` +
        `Today's precipitation probability is ${rain ?? "—"}%.`;
}


/* ==========================================================
   25. METRICS
========================================================== */

function renderMetrics() {

    if (
        !state.weather?.current
    ) {

        return;
    }


    const current =
        state.weather.current;


    const metrics = [

        {
            icon: "🌡️",
            label: "Temperature",
            value:
                formatTemperature(
                    current.temperature_2m
                ),
            note: "Current"
        },

        {
            icon: "🫧",
            label: "Feels Like",
            value:
                formatTemperature(
                    current.apparent_temperature
                ),
            note: "Apparent temperature"
        },

        {
            icon: "💧",
            label: "Humidity",
            value:
                current.relative_humidity_2m == null
                    ? "—"
                    : `${current.relative_humidity_2m}%`,
            note: "Relative humidity"
        },

        {
            icon: "💨",
            label: "Wind",
            value:
                formatSpeed(
                    current.wind_speed_10m
                ),
            note:
                degreesToCompass(
                    current.wind_direction_10m
                )
        },

        {
            icon: "🌬️",
            label: "Gusts",
            value:
                formatSpeed(
                    current.wind_gusts_10m
                ),
            note: "Maximum gust"
        },

        {
            icon: "☁️",
            label: "Cloud Cover",
            value:
                current.cloud_cover == null
                    ? "—"
                    : `${current.cloud_cover}%`,
            note: "Total cloud cover"
        },

        {
            icon: "🌧️",
            label: "Precipitation",
            value:
                current.precipitation == null
                    ? "—"
                    : `${current.precipitation} mm`,
            note: "Current"
        },

        {
            icon: "👁️",
            label: "Visibility",
            value:
                current.visibility == null
                    ? "—"
                    : `${(
                        current.visibility / 1000
                    ).toFixed(1)} km`,
            note: "Current visibility"
        },

        {
            icon: "🎯",
            label: "Pressure",
            value:
                current.pressure_msl == null
                    ? "—"
                    : `${Math.round(
                        current.pressure_msl
                    )} hPa`,
            note: "Sea-level pressure"
        },

        {
            icon: "💦",
            label: "Dew Point",
            value:
                formatTemperature(
                    current.dew_point_2m
                ),
            note: "Dew point"
        },

        {
            icon: "☀️",
            label: "UV Index",
            value:
                current.uv_index == null
                    ? "—"
                    : Number(
                        current.uv_index
                    ).toFixed(1),
            note: "Current UV"
        },

        {
            icon: "🧭",
            label: "Wind Direction",
            value:
                degreesToCompass(
                    current.wind_direction_10m
                ),
            note:
                current.wind_direction_10m == null
                    ? "—"
                    : `${Math.round(
                        current.wind_direction_10m
                    )}°`
        }

    ];


    elements.metrics.innerHTML = "";


    metrics.forEach(metric => {

        const card =
            createElement(
                "article",
                {
                    className:
                        "metric-card glass fade-in"
                }
            );


        const icon =
            createElement(
                "div",
                {
                    className:
                        "metric-icon",
                    text:
                        metric.icon
                }
            );


        const label =
            createElement(
                "div",
                {
                    className:
                        "metric-label",
                    text:
                        metric.label
                }
            );


        const value =
            createElement(
                "div",
                {
                    className:
                        "metric-value",
                    text:
                        metric.value
                }
            );


        const note =
            createElement(
                "div",
                {
                    className:
                        "metric-note",
                    text:
                        metric.note
                }
            );


        card.append(
            icon,
            label,
            value,
            note
        );


        elements.metrics.appendChild(card);

    });

}


/* ==========================================================
   26. HOURLY
========================================================== */

function renderHourly() {

    if (
        !state.weather?.hourly
    ) {

        return;
    }


    const hourly =
        state.weather.hourly;


    elements.hourlyForecast.innerHTML =
        "";


    const times =
        hourly.time || [];


    const currentTime =
        state.weather.current?.time;


    let startIndex =
        times.findIndex(
            time =>
                time >= currentTime
        );


    if (startIndex < 0) {
        startIndex = 0;
    }


    for (
        let i = startIndex;
        i < Math.min(
            startIndex + 24,
            times.length
        );
        i++
    ) {

        const card =
            createElement(
                "div",
                {
                    className:
                        `hour-card glass fade-in ${
                            i === startIndex
                                ? "active"
                                : ""
                        }`
                }
            );


        const code =
            safeNumber(
                hourly.weather_code?.[i]
            );


        const isDay =
            state.weather.current?.is_day
                ? true
                : false;


        const meta =
            getWeatherMeta(
                code,
                isDay
            );


        const time =
            createElement(
                "div",
                {
                    className:
                        "hour-time",
                    text:
                        formatHour(
                            times[i]
                        )
                }
            );


        const icon =
            createElement(
                "div",
                {
                    className:
                        "hour-icon",
                    text:
                        meta.icon
                }
            );


        const temp =
            createElement(
                "div",
                {
                    className:
                        "hour-temp",
                    text:
                        formatTemperature(
                            hourly.temperature_2m?.[i]
                        )
                }
            );


        const rain =
            createElement(
                "div",
                {
                    className:
                        "hour-rain",
                    text:
                        `🌧 ${
                            safeNumber(
                                hourly.precipitation_probability?.[i]
                            ) ?? "—"
                        }%`
                }
            );


        card.append(
            time,
            icon,
            temp,
            rain
        );


        elements.hourlyForecast.appendChild(
            card
        );

    }

}


/* ==========================================================
   27. DAILY
========================================================== */

function renderDaily() {

    if (
        !state.weather?.daily
    ) {

        return;
    }


    const daily =
        state.weather.daily;


    elements.dailyForecast.innerHTML =
        "";


    const count =
        Math.min(
            16,
            daily.time?.length || 0
        );


    for (let i = 0; i < count; i++) {

        const card =
            createElement(
                "article",
                {
                    className:
                        `daily-card glass fade-in ${
                            i === 0
                                ? "today"
                                : ""
                        }`
                }
            );


        const dayName =
            new Intl.DateTimeFormat(
                undefined,
                {
                    weekday: "long"
                }
            ).format(
                new Date(
                    daily.time[i] +
                    "T12:00:00"
                )
            );


        const day =
            createElement(
                "div",
                {
                    className:
                        "daily-day",
                    text:
                        i === 0
                            ? "Today"
                            : dayName
                }
            );


        const date =
            createElement(
                "div",
                {
                    className:
                        "daily-date",
                    text:
                        formatShortDate(
                            daily.time[i] +
                            "T12:00:00"
                        )
                }
            );


        const meta =
            getWeatherMeta(
                safeNumber(
                    daily.weather_code?.[i]
                ),
                true
            );


        const icon =
            createElement(
                "div",
                {
                    className:
                        "daily-icon",
                    text:
                        meta.icon
                }
            );


        const condition =
            createElement(
                "div",
                {
                    className:
                        "daily-condition",
                    text:
                        meta.text
                }
            );


        const temps =
            createElement(
                "div",
                {
                    className:
                        "daily-temp"
                }
            );


        const high =
            createElement(
                "span",
                {
                    text:
                        formatTemperature(
                            daily.temperature_2m_max?.[i]
                        )
                }
            );


        const low =
            createElement(
                "span",
                {
                    text:
                        formatTemperature(
                            daily.temperature_2m_min?.[i]
                        )
                }
            );


        temps.append(
            high,
            low
        );


        const rain =
            createElement(
                "div",
                {
                    className:
                        "daily-rain",
                    text:
                        `🌧 ${
                            safeNumber(
                                daily.precipitation_probability_max?.[i]
                            ) ?? "—"
                        }% chance`
                }
            );


        card.append(
            day,
            date,
            icon,
            condition,
            temps,
            rain
        );


        card.addEventListener(
            "click",
            () =>
                showDailyDetails(i)
        );


        elements.dailyForecast.appendChild(
            card
        );

    }

}


/* ==========================================================
   28. DAILY DETAIL MODAL
========================================================== */

function showDailyDetails(index) {

    const daily =
        state.weather?.daily;


    if (!daily) {
        return;
    }


    const meta =
        getWeatherMeta(
            safeNumber(
                daily.weather_code?.[index]
            ),
            true
        );


    elements.modalBody.innerHTML = "";


    const title =
        createElement(
            "h2",
            {
                text:
                    index === 0
                        ? "Today's Forecast"
                        : `Forecast for ${
                            formatShortDate(
                                daily.time[index] +
                                "T12:00:00"
                            )
                        }`
            }
        );


    const content =
        createElement(
            "div"
        );


    content.innerHTML = `
        <div style="
            font-size:70px;
            margin:20px 0;
        ">
            ${meta.icon}
        </div>
    `;


    const facts = [

        [
            "Condition",
            meta.text
        ],

        [
            "High",
            formatTemperature(
                daily.temperature_2m_max?.[index]
            )
        ],

        [
            "Low",
            formatTemperature(
                daily.temperature_2m_min?.[index]
            )
        ],

        [
            "Rain Chance",
            `${safeNumber(
                daily.precipitation_probability_max?.[index]
            ) ?? "—"}%`
        ],

        [
            "Precipitation",
            `${safeNumber(
                daily.precipitation_sum?.[index]
            ) ?? "—"} mm`
        ],

        [
            "Maximum Wind",
            formatSpeed(
                daily.wind_speed_10m_max?.[index]
            )
        ],

        [
            "Wind Gust",
            formatSpeed(
                daily.wind_gusts_10m_max?.[index]
            )
        ],

        [
            "UV Index",
            daily.uv_index_max?.[index] == null
                ? "—"
                : Number(
                    daily.uv_index_max[index]
                ).toFixed(1)
        ],

        [
            "Sunrise",
            formatHour(
                daily.sunrise?.[index]
            )
        ],

        [
            "Sunset",
            formatHour(
                daily.sunset?.[index]
            )
        ]

    ];


    facts.forEach(
        ([label, value]) => {

            const row =
                createElement(
                    "div",
                    {
                        className:
                            "insight"
                    }
                );


            row.textContent =
                `${label}: ${value}`;


            content.appendChild(row);

        }
    );


    elements.modalBody.append(
        title,
        content
    );


    elements.modal.classList.remove(
        "hidden"
    );

}


/* ==========================================================
   29. SUNRISE / SUNSET
========================================================== */

function renderSun() {

    const daily =
        state.weather?.daily;


    const current =
        state.weather?.current;


    if (
        !daily ||
        !current
    ) {
        return;
    }


    const sunrise =
        daily.sunrise?.[0];


    const sunset =
        daily.sunset?.[0];


    const duration =
        daily.daylight_duration?.[0];


    elements.sunInfo.innerHTML = "";


    const items = [

        [
            "Sunrise",
            formatHour(sunrise)
        ],

        [
            "Sunset",
            formatHour(sunset)
        ],

        [
            "Daylight",
            formatDuration(duration)
        ],

        [
            "State",
            current.is_day
                ? "Daytime"
                : "Nighttime"
        ]

    ];


    items.forEach(
        ([label, value]) => {

            const item =
                createElement(
                    "div",
                    {
                        className:
                            "sun-item"
                    }
                );


            const labelNode =
                createElement(
                    "span",
                    {
                        text:
                            label
                    }
                );


            const valueNode =
                createElement(
                    "strong",
                    {
                        text:
                            value
                    }
                );


            item.append(
                labelNode,
                valueNode
            );


            elements.sunInfo.appendChild(
                item
            );

        }
    );


    const now =
        parseApiDate(
            current.time
        );


    const rise =
        parseApiDate(
            sunrise
        );


    const set =
        parseApiDate(
            sunset
        );


    if (
        now &&
        rise &&
        set
    ) {

        let progress = 0;


        if (now <= rise) {

            progress = 0;

        } else if (now >= set) {

            progress = 100;

        } else {

            progress =
                (
                    (now - rise) /
                    (set - rise)
                ) * 100;
        }


        elements.sunProgressFill.style.width =
            `${clamp(
                progress,
                0,
                100
            )}%`;

    }

}


function formatDuration(seconds) {

    const value =
        safeNumber(seconds);


    if (
        value === null
    ) {
        return "—";
    }


    const totalMinutes =
        Math.round(
            value / 60
        );


    const hours =
        Math.floor(
            totalMinutes / 60
        );


    const minutes =
        totalMinutes % 60;


    return `${hours}h ${minutes}m`;
}


/* ==========================================================
   30. INSIGHTS
========================================================== */

function renderInsights() {

    const hourly =
        state.weather?.hourly;


    if (!hourly) {
        return;
    }


    const temperatures =
        (
            hourly.temperature_2m ||
            []
        )
        .slice(0, 8)
        .map(Number)
        .filter(Number.isFinite);


    const rain =
        (
            hourly.precipitation_probability ||
            []
        )
        .slice(0, 8)
        .map(Number)
        .filter(Number.isFinite);


    const winds =
        (
            hourly.wind_speed_10m ||
            []
        )
        .slice(0, 8)
        .map(Number)
        .filter(Number.isFinite);


    const insights = [];


    if (
        temperatures.length >= 2
    ) {

        const first =
            temperatures[0];

        const last =
            temperatures[
                temperatures.length - 1
            ];


        const difference =
            last - first;


        if (
            Math.abs(difference) >= 2
        ) {

            insights.push(
                difference > 0
                    ? `Temperatures are expected to rise by about ${Math.round(
                        difference
                    )}° over the next several hours.`
                    : `Temperatures are expected to fall by about ${Math.round(
                        Math.abs(difference)
                    )}° over the next several hours.`
            );

        } else {

            insights.push(
                "Temperatures are expected to remain relatively stable over the next several hours."
            );
        }

    }


    if (
        rain.length >= 2
    ) {

        const max =
            Math.max(...rain);

        const min =
            Math.min(...rain);


        if (
            max >= 60 &&
            max - min >= 20
        ) {

            insights.push(
                `The rain probability reaches approximately ${Math.round(
                    max
                )}% during the upcoming hours.`
            );

        } else {

            insights.push(
                `The highest forecast rain probability over the upcoming hours is approximately ${Math.round(
                    max
                )}%.`
            );

        }

    }


    if (
        winds.length >= 2
    ) {

        const average =
            winds.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) /
            winds.length;


        insights.push(
            `Average forecast wind speed across the next several hours is about ${formatSpeed(
                average
            )}.`
        );
    }


    elements.weatherInsights.innerHTML = "";


    if (!insights.length) {

        const empty =
            createElement(
                "div",
                {
                    className:
                        "insight",
                    text:
                        "Weather insights will appear when enough forecast data is available."
                }
            );


        elements.weatherInsights.appendChild(
            empty
        );

        return;
    }


    insights.forEach(
        textValue => {

            const item =
                createElement(
                    "div",
                    {
                        className:
                            "insight",
                        text:
                            textValue
                    }
                );


            elements.weatherInsights.appendChild(
                item
            );

        }
    );

}


/* ==========================================================
   31. AIR QUALITY
========================================================== */

function renderAirQuality() {

    if (
        !elements.airQualityCard
    ) {
        return;
    }


    const current =
        state.airQuality?.current;


    if (!current) {

        elements.airQualityCard.textContent =
            "Air-quality information is temporarily unavailable.";

        return;
    }


    const europeanAQI =
        safeNumber(
            current.european_aqi
        );


    const usAQI =
        safeNumber(
            current.us_aqi
        );


    const aqi =
        europeanAQI ??
        usAQI;


    const category =
        getAQICategory(
            aqi
        );


    elements.airQualityCard.innerHTML = "";


    const main =
        createElement(
            "div",
            {
                className:
                    "aqi-main"
            }
        );


    const number =
        createElement(
            "div",
            {
                className:
                    "aqi-number",
                text:
                    aqi == null
                        ? "—"
                        : Math.round(aqi)
            }
        );


    const right =
        createElement(
            "div"
        );


    const cat =
        createElement(
            "div",
            {
                className:
                    "aqi-category",
                text:
                    category
            }
        );


    const source =
        createElement(
            "div",
            {
                className:
                    "aqi-source",
                text:
                    europeanAQI !== null
                        ? "European AQI"
                        : "US AQI"
            }
        );


    right.append(
        cat,
        source
    );


    main.append(
        number,
        right
    );


    const grid =
        createElement(
            "div",
            {
                className:
                    "aqi-metrics"
            }
        );


    const metrics = [

        [
            "PM2.5",
            current.pm2_5,
            "μg/m³"
        ],

        [
            "PM10",
            current.pm10,
            "μg/m³"
        ],

        [
            "NO₂",
            current.nitrogen_dioxide,
            "μg/m³"
        ],

        [
            "O₃",
            current.ozone,
            "μg/m³"
        ]

    ];


    metrics.forEach(
        ([label, value, unit]) => {

            const card =
                createElement(
                    "div",
                    {
                        className:
                            "aqi-metric"
                    }
                );


            card.innerHTML =
                `
                    <span>${label}</span>
                    <strong>${
                        value == null
                            ? "—"
                            : `${Number(value).toFixed(1)} ${unit}`
                    }</strong>
                `;


            grid.appendChild(
                card
            );

        }
    );


    elements.airQualityCard.append(
        main,
        grid
    );

}


function getAQICategory(aqi) {

    if (aqi === null) {
        return "Unavailable";
    }


    if (aqi <= 20) {
        return "Good";
    }

    if (aqi <= 40) {
        return "Fair";
    }

    if (aqi <= 60) {
        return "Moderate";
    }

    if (aqi <= 80) {
        return "Poor";
    }

    if (aqi <= 100) {
        return "Very Poor";
    }

    return "Extremely Poor";
}


/* ==========================================================
   32. MOON
========================================================== */

function renderMoon() {

    /*
       Open-Meteo's main forecast response does not provide
       moon phase/moonrise/moonset fields in the basic setup.

       Therefore the application does NOT fabricate astronomical
       values.

       This section uses a transparent informational state.
    */

    elements.moonCard.innerHTML = "";


    const icon =
        createElement(
            "div",
            {
                className:
                    "moon-icon",
                text:
                    "🌙"
            }
        );


    const phase =
        createElement(
            "div",
            {
                className:
                    "moon-phase",
                text:
                    "Astronomical moon data not loaded"
            }
        );


    const note =
        createElement(
            "div",
            {
                className:
                    "moon-note",
                text:
                    "Connect a dedicated astronomy source to display moon phase, illumination, rise and set times."
            }
        );


    elements.moonCard.append(
        icon,
        phase,
        note
    );

}


/* ==========================================================
   33. WEATHER THEME
========================================================== */

function updateWeatherTheme() {

    document.body.classList.remove(

        "weather-clear",
        "weather-rain",
        "weather-storm",
        "weather-snow",
        "weather-fog"

    );


    const current =
        state.weather?.current;


    if (!current) {
        return;
    }


    const meta =
        getWeatherMeta(
            safeNumber(
                current.weather_code
            ),
            Boolean(
                current.is_day
            )
        );


    if (
        meta.theme
    ) {

        document.body.classList.add(
            `weather-${meta.theme}`
        );
    }

}


/* ==========================================================
   34. FAVORITES
========================================================== */

function isFavorite(location) {

    if (!location) {
        return false;
    }


    return state.favorites.some(
        item =>
            Math.abs(
                item.latitude -
                location.latitude
            ) < 0.001 &&
            Math.abs(
                item.longitude -
                location.longitude
            ) < 0.001
    );

}


function toggleFavorite() {

    if (!state.location) {
        return;
    }


    if (
        isFavorite(
            state.location
        )
    ) {

        state.favorites =
            state.favorites.filter(
                item =>
                    !(
                        Math.abs(
                            item.latitude -
                            state.location.latitude
                        ) < 0.001 &&
                        Math.abs(
                            item.longitude -
                            state.location.longitude
                        ) < 0.001
                    )
            );

    } else {

        state.favorites = [

            state.location,
            ...state.favorites

        ].slice(0, 20);

    }


    saveStorage(
        "weatherx_favorites",
        state.favorites
    );


    updateFavoriteButton();

    renderFavorites();

}


function updateFavoriteButton() {

    if (
        !elements.favoriteButton
    ) {
        return;
    }


    elements.favoriteButton.textContent =
        isFavorite(
            state.location
        )
            ? "★"
            : "☆";

}


/* ==========================================================
   35. RECENT LOCATIONS
========================================================== */

function saveRecentLocation(location) {

    const cleanLocation = {

        name:
            location.name,

        region:
            location.region,

        country:
            location.country,

        countryCode:
            location.countryCode,

        latitude:
            Number(location.latitude),

        longitude:
            Number(location.longitude),

        timezone:
            location.timezone

    };


    state.recentLocations =
        [
            cleanLocation,

            ...state.recentLocations.filter(
                item =>
                    !(
                        Math.abs(
                            item.latitude -
                            cleanLocation.latitude
                        ) < 0.001 &&
                        Math.abs(
                            item.longitude -
                            cleanLocation.longitude
                        ) < 0.001
                    )
            )

        ].slice(
            0,
            CONFIG.RECENT_LIMIT
        );


    saveStorage(
        "weatherx_recent",
        state.recentLocations
    );


    renderHistory();
}


/* ==========================================================
   36. FAVORITE LIST
========================================================== */

function renderFavorites() {

    elements.favoritesList.innerHTML =
        "";


    if (
        !state.favorites.length
    ) {

        elements.favoritesList.textContent =
            "No favorite locations yet.";

        return;
    }


    state.favorites.forEach(
        (location, index) => {

            const item =
                createLocationItem(
                    location,
                    true,
                    index
                );


            elements.favoritesList.appendChild(
                item
            );

        }
    );

}


/* ==========================================================
   37. HISTORY LIST
========================================================== */

function renderHistory() {

    elements.recentList.innerHTML =
        "";


    if (
        !state.recentLocations.length
    ) {

        elements.recentList.textContent =
            "No recent searches.";

        return;
    }


    state.recentLocations.forEach(
        (location, index) => {

            const item =
                createLocationItem(
                    location,
                    false,
                    index
                );


            elements.recentList.appendChild(
                item
            );

        }
    );

}


function createLocationItem(
    location,
    favorite,
    index
) {

    const item =
        createElement(
            "div",
            {
                className:
                    "location-item"
            }
        );


    const main =
        createElement(
            "div",
            {
                className:
                    "location-item-main"
            }
        );


    const name =
        createElement(
            "strong",
            {
                text:
                    location.name
            }
        );


    const info =
        createElement(
            "span",
            {
                text:
                    [
                        location.region,
                        location.country
                    ]
                    .filter(Boolean)
                    .join(", ")
            }
        );


    main.append(
        name,
        info
    );


    const actions =
        createElement(
            "div",
            {
                className:
                    "location-item-actions"
            }
        );


    const open =
        createElement(
            "button",
            {
                text: "Open"
            }
        );


    open.addEventListener(
        "click",
        () =>
            loadLocation(
                location
            )
    );


    actions.appendChild(
        open
    );


    if (favorite) {

        const remove =
            createElement(
                "button",
                {
                    text: "Remove"
                }
            );


        remove.addEventListener(
            "click",
            () => {

                state.favorites.splice(
                    index,
                    1
                );


                saveStorage(
                    "weatherx_favorites",
                    state.favorites
                );


                renderFavorites();

                updateFavoriteButton();

            }
        );


        actions.appendChild(
            remove
        );

    }


    item.append(
        main,
        actions
    );


    return item;
}


/* ==========================================================
   38. SEARCH RESULTS
========================================================== */

function renderSearchResults(
    results
) {

    elements.searchResults.innerHTML =
        "";


    if (
        !results.length
    ) {

        elements.searchResults.classList.remove(
            "visible"
        );

        return;
    }


    results.forEach(
        location => {

            const button =
                createElement(
                    "button",
                    {
                        className:
                            "search-result"
                    }
                );


            const title =
                createElement(
                    "strong",
                    {
                        text:
                            location.name
                    }
                );


            const details =
                createElement(
                    "span",
                    {
                        text:
                            [
                                location.admin1,
                                location.country
                            ]
                            .filter(Boolean)
                            .join(", ")
                    }
                );


            button.append(
                title,
                details
            );


            button.addEventListener(
                "click",
                async () => {

                    elements.searchResults.classList.remove(
                        "visible"
                    );


                    elements.searchInput.value =
                        [
                            location.name,
                            location.country
                        ]
                        .filter(Boolean)
                        .join(", ");


                    await loadLocation(
                        location
                    );

                }
            );


            elements.searchResults.appendChild(
                button
            );

        }
    );


    elements.searchResults.classList.add(
        "visible"
    );

}


/* ==========================================================
   39. SEARCH
========================================================== */

const performSearch =
    debounce(
        async () => {

            const query =
                elements.searchInput.value.trim();


            if (
                !query
            ) {

                setStatus(
                    "Please enter a city name."
                );

                return;
            }


            state.searchLoading =
                true;


            setStatus(
                "Searching locations..."
            );


            try {

                const results =
                    await searchLocations(
                        query
                    );


                state.searchResults =
                    results;


                renderSearchResults(
                    results
                );


                if (
                    !results.length
                ) {

                    setStatus(
                        "No matching locations were found."
                    );

                } else {

                    setStatus(
                        "Select a location from the results."
                    );
                }


            } catch (error) {

                console.error(
                    error
                );


                setStatus(
                    "Location search failed. Please try again."
                );

            } finally {

                state.searchLoading =
                    false;
            }

        },
        CONFIG.SEARCH_DEBOUNCE
    );


/* ==========================================================
   40. SEARCH SUBMIT
========================================================== */

async function handleSearchSubmit(event) {

    event.preventDefault();


    const query =
        elements.searchInput.value.trim();


    if (
        !query
    ) {

        setStatus(
            "Please enter a city name."
        );

        return;
    }


    try {

        state.searchResults =
            await searchLocations(
                query
            );


        if (
            !state.searchResults.length
        ) {

            setStatus(
                "We couldn't find that location."
            );

            return;
        }


        renderSearchResults(
            state.searchResults
        );


        if (
            state.searchResults.length === 1
        ) {

            const location =
                state.searchResults[0];


            elements.searchResults.classList.remove(
                "visible"
            );


            await loadLocation(
                location
            );

        }

    } catch (error) {

        console.error(
            error
        );


        setStatus(
            friendlyError(
                error
            )
        );

    }

}


/* ==========================================================
   41. GEOLOCATION
========================================================== */

function useCurrentLocation() {

    if (
        !navigator.geolocation
    ) {

        setStatus(
            "Your browser does not support geolocation."
        );

        return;
    }


    setStatus(
        "Requesting your location..."
    );


    navigator.geolocation.getCurrentPosition(

        async position => {

            const latitude =
                position.coords.latitude;

            const longitude =
                position.coords.longitude;


            try {

                const results =
                    await reverseGeocode(
                        latitude,
                        longitude
                    );


                let location;


                if (
                    results.length
                ) {

                    location =
                        results[0];

                } else {

                    location = {

                        name:
                            "Current Location",

                        admin1:
                            "",

                        country:
                            "",

                        country_code:
                            "",

                        latitude,

                        longitude,

                        timezone:
                            ""

                    };

                }


                await loadLocation(
                    location
                );

            } catch (error) {

                console.error(
                    error
                );


                setStatus(
                    "Your location was found, but weather could not be loaded."
                );

            }

        },

        error => {

            if (
                error.code ===
                error.PERMISSION_DENIED
            ) {

                setStatus(
                    "Location permission was denied. Search for your city instead."
                );

            } else if (
                error.code ===
                error.POSITION_UNAVAILABLE
            ) {

                setStatus(
                    "Your current location is unavailable."
                );

            } else if (
                error.code ===
                error.TIMEOUT
            ) {

                setStatus(
                    "Location detection timed out."
                );

            } else {

                setStatus(
                    "Unable to determine your location."
                );
            }

        },

        {

            enableHighAccuracy:
                true,

            timeout:
                10000,

            maximumAge:
                300000

        }

    );

}


/* ==========================================================
   42. REVERSE GEOCODING
========================================================== */

async function reverseGeocode(
    latitude,
    longitude
) {

    /*
       Open-Meteo Geocoding is primarily a forward-search API.

       We therefore return a generic location when the
       coordinate cannot be reverse-resolved.
    */

    try {

        const response =
            await fetch(
                `${CONFIG.GEOCODING_API}?name=${encodeURIComponent(
                    `${latitude},${longitude}`
                )}&count=1&format=json`
            );


        if (
            !response.ok
        ) {
            return [];
        }


        const data =
            await response.json();


        return Array.isArray(
            data.results
        )
            ? data.results
            : [];

    } catch {

        return [];
    }

}


/* ==========================================================
   43. REFRESH
========================================================== */

async function refreshWeather() {

    if (
        !state.location
    ) {

        setStatus(
            "Search for a location first."
        );

        return;
    }


    await loadLocation(
        state.location,
        {
            showCached:
                false,

            addHistory:
                false
        }
    );

}


/* ==========================================================
   44. UNIT TOGGLE
========================================================== */

function toggleTemperatureUnit() {

    state.unit =
        state.unit === "celsius"
            ? "fahrenheit"
            : "celsius";


    saveStorage(
        "weatherx_unit",
        state.unit
    );


    if (
        state.location
    ) {

        loadLocation(
            state.location,
            {
                showCached:
                    false,

                addHistory:
                    false
            }
        );

    }


    updateUnitButton();
}


function updateUnitButton() {

    elements.unitToggle.textContent =
        state.unit === "celsius"
            ? "°C"
            : "°F";
}


/* ==========================================================
   45. THEME
========================================================== */

function applyTheme() {

    document.body.classList.remove(
        "light-mode"
    );


    if (
        state.theme === "light"
    ) {

        document.body.classList.add(
            "light-mode"
        );

        return;
    }


    if (
        state.theme === "system"
    ) {

        const prefersLight =
            window.matchMedia(
                "(prefers-color-scheme: light)"
            ).matches;


        if (prefersLight) {

            document.body.classList.add(
                "light-mode"
            );
        }

    }

}


function cycleTheme() {

    const modes = [
        "system",
        "light",
        "dark"
    ];


    const currentIndex =
        modes.indexOf(
            state.theme
        );


    state.theme =
        modes[
            (currentIndex + 1) %
            modes.length
        ];


    saveStorage(
        "weatherx_theme",
        state.theme
    );


    applyTheme();

    updateThemeButton();

}


function updateThemeButton() {

    const labels = {

        system:
            "◐",

        light:
            "☀",

        dark:
            "☾"

    };


    elements.themeToggle.textContent =
        labels[state.theme] ||
        "◐";

}


/* ==========================================================
   46. SUN / THEME + TIME UPDATE
========================================================== */

function updateClock() {

    if (
        !state.weather?.current ||
        !state.location
    ) {
        return;
    }


    const current =
        state.weather.current;


    elements.localTime.textContent =
        `${formatHour(
            current.time
        )} · ${
            state.location.timezone ||
            "Local time"
        }`;

}


setInterval(
    updateClock,
    60000
);


/* ==========================================================
   47. UPDATED TIME
========================================================== */

function updateUpdatedTime() {

    if (
        !state.lastUpdated
    ) {

        elements.updatedAt.textContent =
            "";

        return;
    }


    const date =
        new Date(
            state.lastUpdated
        );


    elements.updatedAt.textContent =
        `Weather data retrieved at ${
            new Intl.DateTimeFormat(
                undefined,
                {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit"
                }
            ).format(date)
        }`;

}


/* ==========================================================
   48. CANVAS CHART ENGINE
========================================================== */

function setupCanvas(canvas) {

    const rect =
        canvas.getBoundingClientRect();


    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        Math.max(
            1,
            Math.round(
                rect.width * dpr
            )
        );


    canvas.height =
        Math.max(
            1,
            Math.round(
                rect.height * dpr
            )
        );


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    return {

        ctx,

        width:
            rect.width,

        height:
            rect.height

    };

}


function drawLineChart(
    canvas,
    values,
    labels,
    unit = ""
) {

    const {
        ctx,
        width,
        height
    } =
        setupCanvas(
            canvas
        );


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const numericValues =
        values.map(Number)
            .filter(
                Number.isFinite
            );


    if (
        numericValues.length < 2
    ) {

        ctx.fillStyle =
            getTextColor();

        ctx.font =
            "14px system-ui";

        ctx.fillText(
            "Not enough data",
            20,
            30
        );

        return;
    }


    const padding = 30;


    const min =
        Math.min(
            ...numericValues
        );


    const max =
        Math.max(
            ...numericValues
        );


    const range =
        Math.max(
            1,
            max - min
        );


    ctx.strokeStyle =
        getGridColor();


    ctx.lineWidth = 1;


    for (
        let i = 0;
        i < 4;
        i++
    ) {

        const y =
            padding +
            (
                i /
                3
            ) *
            (
                height -
                padding * 2
            );


        ctx.beginPath();

        ctx.moveTo(
            padding,
            y
        );

        ctx.lineTo(
            width - padding,
            y
        );

        ctx.stroke();

    }


    const points =
        numericValues.map(
            (value, index) => {

                const x =
                    padding +
                    (
                        index /
                        (numericValues.length - 1)
                    ) *
                    (
                        width -
                        padding * 2
                    );


                const y =
                    height -
                    padding -
                    (
                        (value - min) /
                        range
                    ) *
                    (
                        height -
                        padding * 2
                    );


                return {
                    x,
                    y,
                    value
                };

            }
        );


    ctx.beginPath();


    points.forEach(
        (point, index) => {

            if (
                index === 0
            ) {

                ctx.moveTo(
                    point.x,
                    point.y
                );

            } else {

                ctx.lineTo(
                    point.x,
                    point.y
                );
            }

        }
    );


    ctx.strokeStyle =
        "#7dd3fc";

    ctx.lineWidth = 3;

    ctx.stroke();


    points.forEach(
        point => {

            ctx.beginPath();

            ctx.arc(
                point.x,
                point.y,
                4,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "#7dd3fc";

            ctx.fill();

        }
    );


    ctx.fillStyle =
        getTextColor();

    ctx.font =
        "11px system-ui";


    ctx.fillText(
        `${Math.round(max)}${unit}`,
        padding,
        15
    );


    ctx.fillText(
        `${Math.round(min)}${unit}`,
        padding,
        height - 6
    );


    if (
        labels?.length
    ) {

        ctx.fillText(
            labels[0] || "",
            padding,
            height - 2
        );


        ctx.textAlign =
            "right";


        ctx.fillText(
            labels[labels.length - 1] || "",
            width - padding,
            height - 2
        );


        ctx.textAlign =
            "left";
    }

}


function getTextColor() {

    return getComputedStyle(
        document.body
    ).getPropertyValue(
        "--muted"
    ) || "#b7c4d4";
}


function getGridColor() {

    return "rgba(255,255,255,.10)";
}


/* ==========================================================
   49. ALL CHARTS
========================================================== */

function drawAllCharts() {

    const hourly =
        state.weather?.hourly;


    if (!hourly) {
        return;
    }


    const times =
        hourly.time || [];


    const start =
        findCurrentHourIndex(
            times
        );


    const end =
        Math.min(
            start + 12,
            times.length
        );


    const labels =
        times
            .slice(start, end)
            .map(
                formatHour
            );


    const temperatures =
        (
            hourly.temperature_2m ||
            []
        )
        .slice(
            start,
            end
        );


    const rain =
        (
            hourly.precipitation_probability ||
            []
        )
        .slice(
            start,
            end
        );


    const wind =
        (
            hourly.wind_speed_10m ||
            []
        )
        .slice(
            start,
            end
        );


    drawLineChart(
        elements.temperatureChart,
        temperatures,
        labels,
        "°"
    );


    drawLineChart(
        elements.rainChart,
        rain,
        labels,
        "%"
    );


    drawLineChart(
        elements.windChart,
        wind,
        labels,
        ` ${getWindUnitLabel()}`
    );

}


function findCurrentHourIndex(
    times
) {

    const current =
        state.weather?.current?.time;


    const index =
        times.findIndex(
            time =>
                time >= current
        );


    return index >= 0
        ? index
        : 0;
}


/* ==========================================================
   50. MAP / LEAFLET
========================================================== */

async function loadLeaflet() {

    if (
        window.L
    ) {
        return;
    }


    const css =
        document.createElement(
            "link"
        );


    css.rel =
        "stylesheet";


    css.href =
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";


    document.head.appendChild(
        css
    );


    await new Promise(
        (resolve, reject) => {

            const script =
                document.createElement(
                    "script"
                );


            script.src =
                "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";


            script.onload =
                resolve;


            script.onerror =
                reject;


            document.head.appendChild(
                script
            );

        }
    );

}


async function initializeMap() {

    if (
        !state.location
    ) {
        return;
    }


    try {

        await loadLeaflet();


        if (
            !state.map
        ) {

            state.map =
                L.map(
                    elements.weatherMap
                ).setView(
                    [
                        state.location.latitude,
                        state.location.longitude
                    ],
                    8
                );


            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution:
                        "© OpenStreetMap contributors"
                }
            ).addTo(
                state.map
            );


            state.mapMarker =
                L.marker(
                    [
                        state.location.latitude,
                        state.location.longitude
                    ]
                )
                .addTo(
                    state.map
                )
                .bindPopup(
                    state.location.name
                );

        } else {

            state.map.setView(
                [
                    state.location.latitude,
                    state.location.longitude
                ],
                8
            );


            state.mapMarker.setLatLng(
                [
                    state.location.latitude,
                    state.location.longitude
                ]
            );


            state.mapMarker
                .setPopupContent(
                    state.location.name
                );

        }


        if (
            state.radar
        ) {

            addRadarLayer();

        }


    } catch (error) {

        console.warn(
            "Map unavailable:",
            error
        );


        elements.weatherMap.textContent =
            "Interactive map could not be loaded.";

    }

}


/* ==========================================================
   51. RAINVIEWER RADAR
========================================================== */

async function loadRadarData() {

    try {

        const data =
            await fetchJSON(
                CONFIG.RADAR_API
            );


        state.radar =
            data;


        addRadarLayer();


    } catch (error) {

        console.warn(
            "Radar unavailable:",
            error
        );


        setStatus(
            "Radar data is temporarily unavailable."
        );

    }

}


function addRadarLayer() {

    if (
        !state.map ||
        !state.radar
    ) {
        return;
    }


    const past =
        state.radar?.radar?.past;


    if (
        !Array.isArray(past) ||
        !past.length
    ) {
        return;
    }


    const frame =
        past[past.length - 1];


    const host =
        state.radar.host;


    const tileUrl =
        `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;


    if (
        state.radarLayer
    ) {

        state.map.removeLayer(
            state.radarLayer
        );

    }


    state.radarLayer =
        L.tileLayer(
            tileUrl,
            {
                opacity:
                    0.60,

                maxZoom:
                    7,

                attribution:
                    "Radar data by RainViewer"
            }
        );


    state.radarLayer.addTo(
        state.map
    );

}


async function toggleRadar() {

    if (
        !state.map
    ) {

        await initializeMap();

    }


    if (
        state.radarLayer
    ) {

        state.map.removeLayer(
            state.radarLayer
        );


        state.radarLayer = null;

        setStatus(
            "Radar layer hidden."
        );


        return;
    }


    if (
        !state.radar
    ) {

        await loadRadarData();

    } else {

        addRadarLayer();

    }


    setStatus(
        "Radar layer enabled."
    );

}


/* ==========================================================
   52. SHARE
========================================================== */

async function shareWeather() {

    if (
        !state.location
    ) {

        setStatus(
            "Load a location before sharing."
        );

        return;
    }


    const url =
        new URL(
            window.location.href
        );


    url.searchParams.set(
        "lat",
        state.location.latitude
    );


    url.searchParams.set(
        "lon",
        state.location.longitude
    );


    url.searchParams.set(
        "city",
        state.location.name
    );


    const shareData = {

        title:
            `Weather in ${state.location.name}`,

        text:
            elements.weatherSummary.textContent,

        url:
            url.toString()

    };


    try {

        if (
            navigator.share
        ) {

            await navigator.share(
                shareData
            );

            setStatus(
                "Weather shared."
            );

        } else {

            await navigator.clipboard.writeText(
                url.toString()
            );

            setStatus(
                "Share link copied to clipboard."
            );

        }

    } catch (error) {

        console.warn(
            "Share cancelled/failed:",
            error
        );

    }

}


/* ==========================================================
   53. URL STATE
========================================================== */

async function loadFromURL() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const latitude =
        Number(
            params.get("lat")
        );


    const longitude =
        Number(
            params.get("lon")
        );


    if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
    ) {

        const city =
            params.get(
                "city"
            ) ||
            "Shared Location";


        await loadLocation({

            name:
                city,

            region:
                "",

            country:
                "",

            country_code:
                "",

            latitude,

            longitude,

            timezone:
                ""

        });

    }

}


/* ==========================================================
   54. SETTINGS MODAL
========================================================== */

function openSettings() {

    elements.modalBody.innerHTML = `

        <h2>WeatherX Settings</h2>

        <div class="insights">

            <div class="insight">

                <strong>
                    Temperature
                </strong>

                <div style="margin-top:10px">

                    <button
                        id="settingsUnitC"
                        class="small-button"
                    >
                        Celsius
                    </button>

                    <button
                        id="settingsUnitF"
                        class="small-button"
                    >
                        Fahrenheit
                    </button>

                </div>

            </div>


            <div class="insight">

                <strong>
                    Wind Unit
                </strong>

                <div style="margin-top:10px">

                    <button
                        class="small-button"
                        data-wind="kmh"
                    >
                        km/h
                    </button>

                    <button
                        class="small-button"
                        data-wind="mph"
                    >
                        mph
                    </button>

                    <button
                        class="small-button"
                        data-wind="ms"
                    >
                        m/s
                    </button>

                    <button
                        class="small-button"
                        data-wind="kn"
                    >
                        knots
                    </button>

                </div>

            </div>


            <div class="insight">

                <strong>
                    Theme
                </strong>

                <p>
                    Current theme:
                    ${state.theme}
                </p>

            </div>


            <div class="insight">

                <strong>
                    Cache
                </strong>

                <button
                    id="clearCacheButton"
                    class="small-button"
                    style="margin-top:10px"
                >
                    Clear Weather Cache
                </button>

            </div>

        </div>

    `;


    elements.modal.classList.remove(
        "hidden"
    );


    document
        .getElementById(
            "settingsUnitC"
        )
        ?.addEventListener(
            "click",
            () => {

                state.unit =
                    "celsius";


                saveStorage(
                    "weatherx_unit",
                    state.unit
                );


                if (
                    state.location
                ) {

                    loadLocation(
                        state.location,
                        {
                            showCached:
                                false,

                            addHistory:
                                false
                        }
                    );

                }


                updateUnitButton();

            }
        );


    document
        .getElementById(
            "settingsUnitF"
        )
        ?.addEventListener(
            "click",
            () => {

                state.unit =
                    "fahrenheit";


                saveStorage(
                    "weatherx_unit",
                    state.unit
                );


                if (
                    state.location
                ) {

                    loadLocation(
                        state.location,
                        {
                            showCached:
                                false,

                            addHistory:
                                false
                        }
                    );

                }


                updateUnitButton();

            }
        );


    document
        .querySelectorAll(
            "[data-wind]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        state.windUnit =
                            button.dataset.wind;


                        saveStorage(
                            "weatherx_wind",
                            state.windUnit
                        );


                        if (
                            state.location
                        ) {

                            loadLocation(
                                state.location,
                                {
                                    showCached:
                                        false,

                                    addHistory:
                                        false
                                }
                            );

                        }

                    }
                );

            }
        );


    document
        .getElementById(
            "clearCacheButton"
        )
        ?.addEventListener(
            "click",
            clearWeatherCache
        );

}


/* ==========================================================
   55. CACHE CLEAR
========================================================== */

function clearWeatherCache() {

    Object.keys(
        localStorage
    )
    .filter(
        key =>
            key.startsWith(
                "weatherx_weather_"
            )
    )
    .forEach(
        key =>
            localStorage.removeItem(
                key
            )
    );


    setStatus(
        "Weather cache cleared."
    );

}


/* ==========================================================
   56. PRINT
========================================================== */

function printForecast() {

    window.print();

}


/* ==========================================================
   57. NAVIGATION
========================================================== */

function setupNavigation() {

    document
        .querySelectorAll(
            "[data-scroll]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const target =
                            document.getElementById(
                                button.dataset.scroll
                            );


                        target?.scrollIntoView({
                            behavior:
                                "smooth",
                            block:
                                "start"
                        });

                    }
                );

            }
        );

}


/* ==========================================================
   58. EVENTS
========================================================== */

function setupEvents() {

    elements.searchForm.addEventListener(
        "submit",
        handleSearchSubmit
    );


    elements.searchInput.addEventListener(
        "input",
        performSearch
    );


    elements.searchInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                elements.searchResults.classList.remove(
                    "visible"
                );

            }

        }
    );


    elements.heroLocationButton.addEventListener(
        "click",
        useCurrentLocation
    );


    elements.locationButton.addEventListener(
        "click",
        useCurrentLocation
    );


    elements.refreshButton.addEventListener(
        "click",
        refreshWeather
    );


    elements.unitToggle.addEventListener(
        "click",
        toggleTemperatureUnit
    );


    elements.themeToggle.addEventListener(
        "click",
        cycleTheme
    );


    elements.favoriteButton.addEventListener(
        "click",
        toggleFavorite
    );


    elements.clearRecentButton.addEventListener(
        "click",
        () => {

            state.recentLocations =
                [];


            saveStorage(
                "weatherx_recent",
                []
            );


            renderHistory();


            setStatus(
                "Recent searches cleared."
            );

        }
    );


    elements.shareButton.addEventListener(
        "click",
        shareWeather
    );


    elements.printButton.addEventListener(
        "click",
        printForecast
    );


    elements.radarButton.addEventListener(
        "click",
        toggleRadar
    );


    elements.mapLocateButton.addEventListener(
        "click",
        async () => {

            if (
                state.map &&
                state.location
            ) {

                state.map.setView(
                    [
                        state.location.latitude,
                        state.location.longitude
                    ],
                    10
                );

            } else {

                await initializeMap();

            }

        }
    );


    elements.settingsButton.addEventListener(
        "click",
        openSettings
    );


    elements.closeModal.addEventListener(
        "click",
        closeModal
    );


    elements.modal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                elements.modal
            ) {

                closeModal();

            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeModal();

            }


            if (
                event.key === "/" &&
                document.activeElement.tagName !==
                    "INPUT" &&
                document.activeElement.tagName !==
                    "TEXTAREA"
            ) {

                event.preventDefault();

                elements.searchInput.focus();

            }

        }
    );


    window.addEventListener(
        "resize",
        debounce(
            drawAllCharts,
            200
        )
    );


    window
        .matchMedia(
            "(prefers-color-scheme: light)"
        )
        .addEventListener(
            "change",
            () => {

                if (
                    state.theme ===
                    "system"
                ) {

                    applyTheme();

                }

            }
        );

}


/* ==========================================================
   59. CLOSE MODAL
========================================================== */

function closeModal() {

    elements.modal.classList.add(
        "hidden"
    );

}


/* ==========================================================
   60. INITIAL LOCATION
========================================================== */

async function initializeApplication() {

    createApplicationShell();

    createStyles();

    cacheElements();

    applyTheme();

    updateUnitButton();

    updateThemeButton();

    renderHistory();

    renderFavorites();

    setupNavigation();

    setupEvents();

    renderAirQuality();

    renderMoon();


    try {

        await loadFromURL();

    } catch (error) {

        console.error(
            "URL initialization failed:",
            error
        );

    }


    setStatus(
        "Search for a city or use your current location."
    );

}


/* ==========================================================
   61. GLOBAL DEBUG API
========================================================== */

if (
    CONFIG.DEV_MODE
) {

    window.WeatherX = {

        state,

        CONFIG,

        searchLocations,

        getWeather,

        getAirQuality,

        loadLocation,

        refreshWeather,

        clearWeatherCache

    };

}


/* ==========================================================
   62. START APPLICATION
========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializeApplication
);