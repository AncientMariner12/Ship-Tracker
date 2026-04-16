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
    let selectedMarker = null;

    if (!sidebar || !closeSidebarButton || !shipDetails) {
        console.error('Sidebar elements are missing from the page.');
        return;
    }

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

    function updateSelectedIndicator(ship) {
        if (!selectedIndicator) return;
        const shipName = ship.NAME || 'Unknown';
        const category = getVesselTypeCategory(ship.TYPE);
        const mmsi = ship.MMSI || 'Unknown';
        selectedIndicator.textContent = `Selected ship: ${shipName} (${category}, MMSI ${mmsi})`;
    }

// Function to categorize vessel types based on AIS type codes
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

// Function to assign colors to ship markers based on AIS type codes
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

    function formatShipInfo(ship, heading) {
        return `
            <dl>
                <dt>Name</dt><dd>${ship.NAME || 'Unknown'}</dd>
                <dt>MMSI</dt><dd>${ship.MMSI || 'Unknown'}</dd>
                <dt>Callsign</dt><dd>${ship.CALLSIGN || 'Unknown'}</dd>
                <dt>IMO</dt><dd>${ship.IMO || 'Unknown'}</dd>
                <dt>Position</dt><dd>${parseFloat(ship.LATITUDE).toFixed(5)}, ${parseFloat(ship.LONGITUDE).toFixed(5)}</dd>
                <dt>Speed</dt><dd>${ship.SOG || 'N/A'} kn</dd>
                <dt>Course</dt><dd>${ship.COG || 'N/A'}°</dd>
                <dt>Heading</dt><dd>${Number.isFinite(heading) ? `${heading.toFixed(1)}°` : 'N/A'}</dd>
                <dt>NAVSTAT</dt><dd>${ship.NAVSTAT || 'Unknown'}</dd>
                <dt>Type</dt><dd>${ship.TYPE || 'Unknown'}</dd>
                <dt>Type category</dt><dd>${getVesselTypeCategory(ship.TYPE)}</dd>
                <dt>Destination</dt><dd>${ship.DEST || 'Unknown'}</dd>
                <dt>ETA</dt><dd>${ship.ETA || 'Unknown'}</dd>
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

    // Draw ship arrows from local AIS data JSON
    fetch('ais_data.json')
        .then((response) => response.json())
        .then((ships) => {
        // Avoid rendering too many markers at once in the browser
        const maxMarkers = 400;

        ships.slice(0, maxMarkers).forEach((ship) => {
            const lat = parseFloat(ship.LATITUDE);
            const lon = parseFloat(ship.LONGITUDE);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

            let heading = parseFloat(ship.HEADING);
            if (!Number.isFinite(heading) || heading < 0 || heading >= 360) {
                heading = parseFloat(ship.COG);
            }
            if (!Number.isFinite(heading)) heading = 0;

            const icon = createShipIcon(ship, heading, false);
            const marker = L.marker([lat, lon], { icon }).addTo(map);
            marker.shipInfo = { ship, heading };

            marker.bindPopup(`MMSI: ${ship.MMSI || 'unknown'}<br>Speed: ${ship.SOG || 'N/A'} kn<br>Heading: ${heading.toFixed(1)}°`);

            marker.on('click', () => {
                if (selectedMarker && selectedMarker !== marker) {
                    selectedMarker.setIcon(createShipIcon(selectedMarker.shipInfo.ship, selectedMarker.shipInfo.heading, false));
                }

                selectedMarker = marker;
                marker.setIcon(createShipIcon(ship, heading, true));
                shipDetails.innerHTML = formatShipInfo(ship, heading);
                updateSelectedIndicator(ship);
                showSidebar();
            });
        });

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
