const API_KEY = "223414.29UK92apIJ4FLU";

// Add as many ships as you want here, separated by commas
// Examples include "OH7RDA" (test station) or real ship names/MMSIs
const callsigns = ["SHIP1", "SHIP2", "OH7RDA", "MMSI244660429"]; 

const map = L.map('map').setView([50, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markers = new Map();

const shipIcon = L.divIcon({
    html: '<div style="font-size: 24px;">🚢</div>',
    className: 'ship-marker',
    iconSize: [30, 30]
});

async function fetchPositions() {
    try {
        const nameParam = callsigns.join(",");
        const targetUrl = `https://api.aprs.fi/api/get?name=${encodeURIComponent(nameParam)}&what=loc&apikey=${API_KEY}&format=json`;
        
        // Using a CORS proxy to fix the "CORS error"
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        const resp = await fetch(proxyUrl);
        const json = await resp.json();

        if (json.result === "ok" && json.entries) {
            const bounds = L.latLngBounds();
            
            json.entries.forEach(entry => {
                const lat = parseFloat(entry.lat);
                const lon = parseFloat(entry.lng);
                
                if (markers.has(entry.name)) {
                    markers.get(entry.name).setLatLng([lat, lon]);
                } else {
                    const marker = L.marker([lat, lon], { icon: shipIcon }).addTo(map);
                    marker.bindPopup(`<b>Ship:</b> ${entry.name}`);
                    markers.set(entry.name, marker);
                }
                bounds.extend([lat, lon]);
            });

            // Automatically zoom the map to show all found ships
            if (json.entries.length > 0) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    } catch (err) {
        console.error("Tracker Error:", err);
    }
}

fetchPositions();
setInterval(fetchPositions, 60000); // Update every minute