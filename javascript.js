// Ship Tracker Application
// Initialize the Leaflet map
let map = L.map('map').setView([50, 0], 7);

// Add OpenStreetMap tiles to the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);
