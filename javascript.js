// Ship Tracker Application
window.addEventListener('DOMContentLoaded', () => {
    // Initialize the Leaflet map
    const map = L.map('map').setView([50, 0], 7);

    // Add OpenStreetMap tiles to the map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const sidebar = document.getElementById('sidebar');
    const closeSidebarButton = document.getElementById('close-sidebar');
    const shipDetails = document.getElementById('ship-details');
    const selectedIndicator = document.getElementById('selected-indicator');
    const shipImage = document.getElementById('ship-image');
    const shipImageCaption = document.getElementById('ship-image-caption');
    const addShipButton = document.getElementById('add-ship-button');
    const addShipPanel = document.getElementById('add-ship-panel');
    const addShipForm = document.getElementById('add-ship-form');
    const cancelAddShipButton = document.getElementById('cancel-add-ship');
    const downloadAISButton = document.getElementById('download-ais-button');
    const showKeyButton = document.getElementById('show-key-button');
    const keyPanel = document.getElementById('key-panel');
    const closeKeyPanel = document.getElementById('close-key-panel');
    let selectedMarker = null;
    let loadedShips = [];

    // Locate me button functionality: show the user's current position on the map
    const locateButton = document.getElementById('locate-button');
    let userMarker = null;

    locateButton.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                // Remove an existing user marker before adding a new one
                if (userMarker) {
                    map.removeLayer(userMarker);
                }

                userMarker = L.marker([lat, lon]).addTo(map);
                userMarker.bindPopup('Your Location').openPopup();
                map.setView([lat, lon], 10);
            }, (error) => {
                alert('Unable to retrieve your location: ' + error.message);
            });
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    });

    if (!sidebar || !closeSidebarButton || !shipDetails || !shipImage || !shipImageCaption || !addShipButton || !addShipPanel || !addShipForm || !cancelAddShipButton || !downloadAISButton || !showKeyButton || !keyPanel || !closeKeyPanel) {
        console.error('Required page elements are missing from the page.');
        return;
    }

    function toggleAddShipPanel(show) {
        addShipPanel.classList.toggle('hidden', !show);
        addShipPanel.setAttribute('aria-hidden', String(!show));
        if (show) {
            addShipForm.querySelector('input[name="NAME"]').focus();
        }
    }

    function toggleKeyPanel(show) {
        keyPanel.classList.toggle('hidden', !show);
        keyPanel.setAttribute('aria-hidden', String(!show));
    }

    function downloadAISData() {
        const blob = new Blob([JSON.stringify(loadedShips, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'ais_data_updated.json';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    function renderShipMarker(ship, headingOverride = null) {
        const lat = parseFloat(ship.LATITUDE);
        const lon = parseFloat(ship.LONGITUDE);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        let heading = Number.isFinite(headingOverride) ? headingOverride : parseFloat(ship.HEADING);
        if (!Number.isFinite(heading) || heading < 0 || heading >= 360) {
            heading = parseFloat(ship.COG);
        }
        if (!Number.isFinite(heading)) heading = 0;

        const icon = createShipIcon(ship, heading, false);
        const marker = L.marker([lat, lon], { icon }).addTo(map);
        marker.shipInfo = { ship, heading };

        marker.bindPopup(`MMSI: ${ship.MMSI || 'unknown'}<br>Speed: ${ship.SOG || 'N/A'} kn<br>Heading: ${heading.toFixed(1)}°`);

        marker.on('click', async () => {
            if (selectedMarker && selectedMarker !== marker) {
                selectedMarker.setIcon(createShipIcon(selectedMarker.shipInfo.ship, selectedMarker.shipInfo.heading, false));
            }

            selectedMarker = marker;
            marker.setIcon(createShipIcon(ship, heading, true));
            document.getElementById('basic-tab').innerHTML = formatBasicInfo(ship);
            document.getElementById('navigation-tab').innerHTML = formatNavigationInfo(ship, heading);
            document.getElementById('technical-tab').innerHTML = formatTechnicalInfo(ship);
            updateSelectedIndicator(ship);
            showSidebar();
            await fetchShipImage(ship);
        });
    }

    addShipButton.addEventListener('click', () => toggleAddShipPanel(true));
    cancelAddShipButton.addEventListener('click', () => toggleAddShipPanel(false));
    downloadAISButton.addEventListener('click', downloadAISData);
    showKeyButton.addEventListener('click', () => toggleKeyPanel(true));
    closeKeyPanel.addEventListener('click', () => toggleKeyPanel(false));

    addShipForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(addShipForm);
        const newShip = {
            NAME: formData.get('NAME')?.toString().trim() || 'Unnamed ship',
            MMSI: formData.get('MMSI')?.toString().trim() || '',
            IMO: formData.get('IMO')?.toString().trim() || '0',
            CALLSIGN: formData.get('CALLSIGN')?.toString().trim() || 'Unknown',
            TYPE: formData.get('TYPE')?.toString().trim() || '0',
            LATITUDE: formData.get('LATITUDE')?.toString().trim() || '0',
            LONGITUDE: formData.get('LONGITUDE')?.toString().trim() || '0',
            HEADING: formData.get('HEADING')?.toString().trim() || '0',
            SOG: formData.get('SOG')?.toString().trim() || '0',
            COG: formData.get('COG')?.toString().trim() || '0',
            NAVSTAT: 'Unknown',
            DEST: formData.get('DEST')?.toString().trim() || 'Unknown',
            ETA: formData.get('ETA')?.toString().trim() || 'Unknown',
            DRAUGHT: formData.get('DRAUGHT')?.toString().trim() || 'Unknown',
            TSTAMP: formData.get('TSTAMP')?.toString().trim() || new Date().toISOString()
        };

        const lat = parseFloat(newShip.LATITUDE);
        const lon = parseFloat(newShip.LONGITUDE);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            alert('Please enter valid latitude and longitude values.');
            return;
        }

        loadedShips.push(newShip);
        renderShipMarker(newShip);
        addShipForm.reset();
        toggleAddShipPanel(false);
        map.setView([lat, lon], 8);
    });

    // Build a rotated SVG arrow marker for a ship, using its AIS type to assign the color.
    function createShipIcon(ship, heading, isSelected = false) {
        const arrowColor = getTypeColor(ship.TYPE);
        const strokeWidth = isSelected ? 4 : 2;
        const selectedClass = isSelected ? ' selected' : '';

        return L.divIcon({
            className: 'ship-arrow-icon',
            html: `<div class="ship-arrow-wrapper${selectedClass}" style="width: 28px; height: 28px; transform: rotate(${heading}deg); transform-origin: center center; display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(-103 -211.36)">
                        <path d="m134 242.36-30-15 30-15-10 15 10 15z" fill="none" stroke="${arrowColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth}"/>
                    </g>
                </svg>
            </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    }

    // Update the sidebar header text with the currently selected ship details.
    function updateSelectedIndicator(ship) {
        if (!selectedIndicator) return;
        const shipName = ship.NAME || 'Unknown';
        const category = getVesselTypeCategory(ship.TYPE);
        const mmsi = ship.MMSI || 'Unknown';
        selectedIndicator.textContent = `Selected ship: ${shipName} (${category}, MMSI ${mmsi})`;
    }

    // Clear the ship image UI while a new image search is underway.
    function clearShipImage() {
        shipImage.hidden = true;
        shipImage.src = '';
        shipImage.alt = '';
        shipImageCaption.textContent = 'Searching for a Wikidata image...';
    }

    // Display a ship image once it has been found.
    function setShipImage(url, title) {
        shipImage.src = url;
        shipImage.alt = `Photo of ${title}`;
        shipImage.hidden = false;
        shipImageCaption.textContent = `Image source: Wikimedia Commons via Wikidata (${title})`;
    }

    // Show a fallback message when no image is available in Wikidata.
    function showNoShipImage() {
        shipImage.hidden = true;
        shipImage.src = '';
        shipImage.alt = '';
        shipImageCaption.textContent = 'No Wikidata image found for this ship.';
    }

    function commonsFileUrl(fileName) {
        const normalized = String(fileName || '').replace(/^File:/i, '').trim();
        return normalized ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(normalized)}` : null;
    }

    // Search Wikidata via SPARQL for a ship entry by its IMO number and return the first image found.
    async function getWikidataImageByIMO(imo) {
        const query = `SELECT ?item ?itemLabel ?image WHERE { ?item wdt:P371 "${imo}" . OPTIONAL { ?item wdt:P18 ?image } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 1`;
        const url = new URL('https://query.wikidata.org/sparql');
        url.search = new URLSearchParams({ query, format: 'json' });

        const response = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
        if (!response.ok) return null;

        const data = await response.json();
        const result = data?.results?.bindings?.[0];
        if (!result) return null;

        return result.image?.value || null;
    }

    // Search Wikidata via SPARQL for a ship entry by its MMSI number and return the first image found.
    async function getWikidataImageByMMSI(mmsi) {
        const query = `SELECT ?item ?itemLabel ?image WHERE { ?item wdt:P587 "${mmsi}" . OPTIONAL { ?item wdt:P18 ?image } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 1`;
        const url = new URL('https://query.wikidata.org/sparql');
        url.search = new URLSearchParams({ query, format: 'json' });

        const response = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
        if (!response.ok) return null;

        const data = await response.json();
        const result = data?.results?.bindings?.[0];
        if (!result) return null;

        return result.image?.value || null;
    }

    async function searchWikidataEntity(query) {
        const url = new URL('https://www.wikidata.org/w/api.php');
        url.search = new URLSearchParams({
            action: 'wbsearchentities',
            search: query,
            language: 'en',
            format: 'json',
            limit: '5',
            origin: '*'
        }).toString();

        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return data?.search || [];
    }

    async function getWikidataImageByEntityId(entityId) {
        const url = new URL('https://www.wikidata.org/w/api.php');
        url.search = new URLSearchParams({
            action: 'wbgetentities',
            ids: entityId,
            props: 'claims|labels',
            languages: 'en',
            format: 'json',
            origin: '*'
        }).toString();

        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const entity = data?.entities?.[entityId];
        if (!entity) return null;

        const imageClaim = entity.claims?.P18?.[0];
        const imageValue = imageClaim?.mainsnak?.datavalue?.value;
        if (!imageValue) return null;
        return commonsFileUrl(imageValue);
    }

    // Try to load a ship image from Wikidata, with MMSI as the primary lookup key and IMO as a fallback.
    async function fetchShipImage(ship) {
        clearShipImage();

        if (ship.MMSI) {
            const url = await getWikidataImageByMMSI(ship.MMSI);
            if (url) {
                setShipImage(url, `MMSI ${ship.MMSI}`);
                return;
            }
        }

        if (ship.IMO && ship.IMO !== '0') {
            const url = await getWikidataImageByIMO(ship.IMO);
            if (url) {
                setShipImage(url, `IMO ${ship.IMO}`);
                return;
            }
        }

        showNoShipImage();
    }


// Function to categorize vessel types based on AIS type codes
    // Convert AIS vessel type codes into human-readable categories used in the sidebar.
    function getVesselTypeCategory(typeCode) {
        const type = Number(typeCode);
        if (!Number.isFinite(type)) return 'Unknown';
        if (type === 0) return 'Not available (default)';
        if (type >= 20 && type <= 29) return 'Wing in Ground (WIG)';
        if (type === 30) return 'Fishing';
        if (type === 31 || type === 32) return 'Towing';
        if (type === 33) return 'Dredging';
        if (type === 35) return 'Military Ops';
        if (type >= 40 && type <= 49) return 'High Speed Craft (HSC)';
        if (type === 50) return 'Pilot Vessel';
        if (type === 51) return 'Search and Rescue (SAR)';
        if (type === 52) return 'Tug';
        if (type === 53) return 'Port Tender';
        if (type >= 60 && type <= 69) return 'Passenger';
        if (type >= 70 && type <= 79) return 'Cargo';
        if (type >= 80 && type <= 89) return 'Tanker';
        if (type >= 90 && type <= 99) return 'Other Type';
        return 'Unknown';
    }

    // Convert AIS vessel type codes into marker colors for the map.
    function getTypeColor(typeCode) {
        const type = Number(typeCode);
        if (!Number.isFinite(type)) return '#7f8c8d';
        if (type === 0) return '#7f8c8d';
        if (type >= 20 && type <= 29) return '#8a2be2';
        if (type === 30) return '#2e8b57';
        if (type === 31 || type === 32) return '#ff8c00';
        if (type === 33) return '#8b4513';
        if (type === 35) return '#dc143c';
        if (type >= 40 && type <= 49) return '#1e90ff';
        if (type === 50) return '#ffd700';
        if (type === 51) return '#ff4500';
        if (type === 52) return '#008080';
        if (type === 53) return '#20b2aa';
        if (type >= 60 && type <= 69) return '#ff69b4';
        if (type >= 70 && type <= 79) return '#228b22';
        if (type >= 80 && type <= 89) return '#800000';
        if (type >= 90 && type <= 99) return '#696969';
        return '#7f8c8d';
    }

    function formatBasicInfo(ship) {
        return `
            <dl>
                <dt>Name</dt><dd>${ship.NAME || 'Unknown'}</dd>
                <dt>MMSI</dt><dd>${ship.MMSI || 'Unknown'}</dd>
                <dt>Callsign</dt><dd>${ship.CALLSIGN || 'Unknown'}</dd>
                <dt>IMO</dt><dd>${ship.IMO || 'Unknown'}</dd>
                <dt>Type</dt><dd>${ship.TYPE || 'Unknown'}</dd>
                <dt>Type category</dt><dd>${getVesselTypeCategory(ship.TYPE)}</dd>
            </dl>
        `;
    }

    function formatNavigationInfo(ship, heading) {
        return `
            <dl>
                <dt>Position</dt><dd>${parseFloat(ship.LATITUDE).toFixed(5)}, ${parseFloat(ship.LONGITUDE).toFixed(5)}</dd>
                <dt>Speed</dt><dd>${ship.SOG || 'N/A'} kn</dd>
                <dt>Course</dt><dd>${ship.COG || 'N/A'}°</dd>
                <dt>Heading</dt><dd>${Number.isFinite(heading) ? `${heading.toFixed(1)}°` : 'N/A'}</dd>
                <dt>NAVSTAT</dt><dd>${ship.NAVSTAT || 'Unknown'}</dd>
                <dt>Destination</dt><dd>${ship.DEST || 'Unknown'}</dd>
                <dt>ETA</dt><dd>${ship.ETA || 'Unknown'}</dd>
            </dl>
        `;
    }

    function formatTechnicalInfo(ship) {
        return `
            <dl>
                <dt>Draught</dt><dd>${ship.DRAUGHT || 'Unknown'}</dd>
                <dt>Timestamp</dt><dd>${ship.TSTAMP || 'Unknown'}</dd>
            </dl>
        `;
    }

    function showSidebar() {
        sidebar.classList.add('visible');
        sidebar.setAttribute('aria-hidden', 'false');
    }

    function hideSidebar() {
        sidebar.classList.remove('visible');
        sidebar.setAttribute('aria-hidden', 'true');
    }

    closeSidebarButton.addEventListener('click', hideSidebar);

    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab') + '-tab';
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Draw ship arrows from local AIS data JSON and wire up marker click behavior.
    fetch('ais_data.json')
        .then((response) => response.json())
        .then((ships) => {
            loadedShips = ships;
            // Avoid rendering too many markers at once in the browser
            const maxMarkers = 400;

            ships.slice(0, maxMarkers).forEach((ship) => renderShipMarker(ship));

            // Center the map on the first ship in the data set, if available.
            if (ships.length > 0) {
                const first = ships[0];
                const fLat = parseFloat(first.LATITUDE);
                const fLon = parseFloat(first.LONGITUDE);
                if (Number.isFinite(fLat) && Number.isFinite(fLon)) {
                    map.setView([fLat, fLon], 6);
                }
            }
        })
        .catch((err) => {
            console.error('Unable to load AIS data:', err);
        });
});
