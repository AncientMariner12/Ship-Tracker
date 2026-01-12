// Ship Tracker Application
// This script connects to the AISstream.io WebSocket API to receive real-time ship position data
// and displays the ships as markers on an interactive Leaflet map.

// Initialize the Leaflet map
// Center the map at coordinates [50, 0] (English Channel) with zoom level 7
let map = L.map('map').setView([50, 0], 7);

// Add OpenStreetMap tiles to the map
// This provides the base map layer with attribution to OpenStreetMap contributors
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Create a Map object to store ship markers by their MMSI (Maritime Mobile Service Identity)
// This allows us to update existing markers instead of creating duplicates
let markers = new Map();

// Define a custom ship icon using a ship emoji
let shipIcon = L.divIcon({
    html: '<div style="font-size: 32px; color: red;">🚢</div>',
    className: 'ship-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16] // Center the icon on the ship's position
});

// Add a test marker to verify markers work
L.marker([50, 0], {icon: shipIcon}).addTo(map).bindPopup('Test Ship - If you see this, markers work!');

// Create a WebSocket connection to the AISstream.io real-time data stream
const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

// Event handler for WebSocket errors
socket.onerror = function(error) {
    console.error('WebSocket error:', error);
};

// Event handler for WebSocket close
socket.onclose = function(event) {
    console.log('WebSocket closed:', event.code, event.reason);
};

// Event handler for when the WebSocket connection opens
socket.onopen = function() {
    console.log('WebSocket connection opened');
    // Define the subscription message to request specific ship data
    let subscriptionMessage = {
        "APIKey": "289f4bd3ce880b52e71a494d92317daedab2e27a", // Your AISstream.io API key
        "BoundingBoxes": [[[-10, 45], [10, 55]]], // Larger English Channel/North Sea area
        "FilterMessageTypes": ["PositionReport"] // Only receive position report messages
    };

    // Send the subscription message to start receiving data
    socket.send(JSON.stringify(subscriptionMessage));
    console.log('Subscription message sent:', subscriptionMessage);
};

// Event handler for incoming WebSocket messages
socket.onmessage = function(event) {
    try {
        let data = JSON.parse(event.data);
        console.log('Received message type:', data.MessageType);
        console.log('Full message:', data);

        if (data.MessageType === 'PositionReport') {
            let report = data.Message.PositionReport;
            let lat = report.Latitude;
            let lon = report.Longitude;
            let mmsi = report.UserID;
            let heading = report.Heading;

            if (markers.has(mmsi)) {
                markers.get(mmsi).setLatLng([lat, lon]);
            } else {
                let marker = L.marker([lat, lon], { icon: shipIcon }).addTo(map);
                marker.bindPopup('Ship MMSI: ' + mmsi + ' Heading: ' + (heading || 'N/A'));
                markers.set(mmsi, marker);
            }
        }

    } catch (e) {
        console.error('Error processing message:', e);
    }
};
