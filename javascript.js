// Ship Tracker Application
// Initialize the Leaflet map
let map = L.map('map').setView([50, 0], 7);

// Add OpenStreetMap tiles to the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

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

            const arrowIcon = L.divIcon({
                className: 'ship-arrow-icon',
                html: `<div style="width: 28px; height: 28px; transform: rotate(${heading}deg); transform-origin: center center;">
                    <img src="arrow.svg" style="width: 100%; height: 100%;" alt="Ship arrow" />
                </div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const marker = L.marker([lat, lon], { icon: arrowIcon }).addTo(map);
            marker.bindPopup(`MMSI: ${ship.MMSI || 'unknown'}<br>Speed: ${ship.SOG || 'N/A'} kn<br>Heading: ${heading.toFixed(1)}°`);
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
