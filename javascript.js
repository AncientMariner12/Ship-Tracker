// SHIP TRACKER APPLICATION


window.addEventListener('DOMContentLoaded', () => {

    // Initialize the Leaflet map centered on Europe with zoom level 7
    const map = L.map('map').setView([50, 0], 7);

    // Add OpenStreetMap tile layer to display the base map with attribution
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png', {
        attribution:"Map tiles by Carto, under CC BY 3.0. Data by OpenStreetMap, under ODbL."
    }).addTo(map);

    // Sidebar elements for displaying ship information
    const sidebar = document.getElementById('sidebar');
    const closeSidebarButton = document.getElementById('close-sidebar');
    const shipDetails = document.getElementById('ship-details');
    const selectedIndicator = document.getElementById('selected-indicator');
    const shipImage = document.getElementById('ship-image');
    const shipImageCaption = document.getElementById('ship-image-caption');
    
    // Add ship form and related elements
    const addShipButton = document.getElementById('add-ship-button');
    const addShipPanel = document.getElementById('add-ship-panel');
    const addShipForm = document.getElementById('add-ship-form');
    const cancelAddShipButton = document.getElementById('cancel-add-ship');
    
    // Map control buttons and legend panel
    const downloadAISButton = document.getElementById('download-ais-button');
    const showKeyButton = document.getElementById('show-key-button');
    const keyPanel = document.getElementById('key-panel');
    const closeKeyPanel = document.getElementById('close-key-panel');
    
    // Application state variables
    let selectedMarker = null;  // Currently selected ship marker on the map
    let loadedShips = [];       // Array of all loaded ships from AIS data

    // Get references to locate button and user location marker
    const locateButton = document.getElementById('locate-button');
    let userMarker = null;  // Stores the user's location marker on the map

    // Event listener for the "Locate me" button - uses geolocation API to show user's current position
    locateButton.addEventListener('click', () => {
        if (navigator.geolocation) {
            // Request user's current geographic position
            navigator.geolocation.getCurrentPosition((position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                // Remove previous user marker if one exists to avoid duplicates
                if (userMarker) {
                    map.removeLayer(userMarker);
                }

                // Create a new marker at the user's location with a popup
                userMarker = L.marker([lat, lon]).addTo(map);
                userMarker.bindPopup('Your Location').openPopup();
                // Center the map on the user's location with a closer zoom level
                map.setView([lat, lon], 10);
            }, (error) => {
                alert('Unable to retrieve your location: ' + error.message);
            });
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    });


    // Validate that all required elements exist before proceeding
    if (!sidebar || !closeSidebarButton || !shipDetails || !shipImage || !shipImageCaption || !addShipButton || !addShipPanel || !addShipForm || !cancelAddShipButton || !downloadAISButton || !showKeyButton || !keyPanel || !closeKeyPanel) {
        console.error('Required page elements are missing from the page.');
        return;
    }

    //Toggle visibility of the add ship panel
     
    function toggleAddShipPanel(show) {
        addShipPanel.classList.toggle('hidden', !show);
        if (show) {
            // Auto-focus on the ship name input field when panel opens
            addShipForm.querySelector('input[name="NAME"]').focus();
        }
    }

    //Toggle visibility of the map key/legend panel
    function toggleKeyPanel(show) {
        keyPanel.classList.toggle('hidden', !show);
    }

    //Download currently loaded AIS data as a JSON file
 
    function downloadAISData() {
        // Create a Blob containing the JSON-formatted ship data
        const blob = new Blob([JSON.stringify(loadedShips, null, 2)], { type: 'application/json' });
        // Generate a temporary download URL for the blob
        const url = URL.createObjectURL(blob);
        // Create a temporary link element to trigger the download
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'ais_data_updated.json';
        //click to start download
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        // Revoke the object URL to free up memory
        URL.revokeObjectURL(url);
    }

    //Render a ship marker on the map and set up interaction handlers

    function renderShipMarker(ship, headingOverride = null) {
        // Extract and validate latitude and longitude
        const lat = parseFloat(ship.LATITUDE);
        const lon = parseFloat(ship.LONGITUDE);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;  // Skip if coordinates are invalid

        // Determine heading
        let heading = Number.isFinite(headingOverride) ? headingOverride : parseFloat(ship.HEADING);
        // Validate heading is in valid range (0-360 degrees)
        if (!Number.isFinite(heading) || heading < 0 || heading >= 360) {
            heading = parseFloat(ship.COG);  // Fall back 
        }
        // Default to 0 degrees if invalid
        if (!Number.isFinite(heading)) heading = 0;

        // Create the ship icon 
        const icon = createShipIcon(ship, heading, false);
        // Add marker to the map with the ship icon
        const marker = L.marker([lat, lon], { icon }).addTo(map);
        // Store ship data and heading on the marker for later retrieval
        marker.shipInfo = { ship, heading };

        // Bind a popup showing key ship information
        marker.bindPopup(`MMSI: ${ship.MMSI || 'unknown'}<br>Speed: ${ship.SOG || 'N/A'} kn<br>Heading: ${heading.toFixed(1)}°`);

        // Set up click handler to select the ship and show details in sidebar
        marker.on('click', async () => {
            // Deselect previous marker if one was selected
            if (selectedMarker && selectedMarker !== marker) {
                selectedMarker.setIcon(createShipIcon(selectedMarker.shipInfo.ship, selectedMarker.shipInfo.heading, false));
            }

            // Select this marker
            selectedMarker = marker;
            marker.setIcon(createShipIcon(ship, heading, true));
            
            // Populate sidebar tabs with ship information
            document.getElementById('basic-tab').innerHTML = formatBasicInfo(ship);
            document.getElementById('navigation-tab').innerHTML = formatNavigationInfo(ship, heading);
            document.getElementById('technical-tab').innerHTML = formatTechnicalInfo(ship);
            
            // Update the selected indicator text and show the sidebar
            updateSelectedIndicator(ship);
            showSidebar();
            
            // Attempt to fetch and display a ship image from Wikidata
            await fetchShipImage(ship);
        });
    }

    // click handlers for all map control buttons
    addShipButton.addEventListener('click', () => toggleAddShipPanel(true));
    cancelAddShipButton.addEventListener('click', () => toggleAddShipPanel(false));
    downloadAISButton.addEventListener('click', downloadAISData);
    showKeyButton.addEventListener('click', () => toggleKeyPanel(true));
    closeKeyPanel.addEventListener('click', () => toggleKeyPanel(false));

    // Handle form submission to add a new ship to the map
    addShipForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        // Extract form data into an object
        const formData = new FormData(addShipForm);
        // Create a new ship object with form data, using defaults for empty fields
        const newShip = {
            NAME: formData.get('NAME')?.toString().trim() || 'Unnamed ship',
            MMSI: formData.get('MMSI')?.toString().trim() || '',  // Maritime Mobile Service Identity
            IMO: formData.get('IMO')?.toString().trim() || '0',   // International Maritime Organization number
            CALLSIGN: formData.get('CALLSIGN')?.toString().trim() || 'Unknown',
            TYPE: formData.get('TYPE')?.toString().trim() || '0',  // AIS vessel type code
            LATITUDE: formData.get('LATITUDE')?.toString().trim() || '0',
            LONGITUDE: formData.get('LONGITUDE')?.toString().trim() || '0',
            HEADING: formData.get('HEADING')?.toString().trim() || '0',  // Ship's heading in degrees
            SOG: formData.get('SOG')?.toString().trim() || '0',  // Speed Over Ground in knots
            COG: formData.get('COG')?.toString().trim() || '0',  // Course Over Ground in degrees
            NAVSTAT: 'Unknown',  // Navigation Status
            DEST: formData.get('DEST')?.toString().trim() || 'Unknown',  // Destination
            ETA: formData.get('ETA')?.toString().trim() || 'Unknown',    // Estimated Time of Arrival
            DRAUGHT: formData.get('DRAUGHT')?.toString().trim() || 'Unknown',  // Ship's draught in meters
            TSTAMP: formData.get('TSTAMP')?.toString().trim() || new Date().toISOString()  // Timestamp of data
        };

        // Validate that coordinates are valid numbers
        const lat = parseFloat(newShip.LATITUDE);
        const lon = parseFloat(newShip.LONGITUDE);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            alert('Please enter valid latitude and longitude values.');
            return;
        }

        // Add the new ship to the ships array and render it on the map
        loadedShips.push(newShip);
        renderShipMarker(newShip);
        // Clear the form and close the add ship panel
        addShipForm.reset();
        toggleAddShipPanel(false);
        // Center the map on the newly added ship
        map.setView([lat, lon], 8);
    });


    // Create a custom ship icon (SVG arrow) rotated according to heading

    function createShipIcon(ship, heading, isSelected = false) {
        // Get color based on ship type
        const arrowColor = getTypeColor(ship.TYPE);
        const strokeWidth = isSelected ? 4 : 2;  // Thicker stroke for selected markers
        const selectedClass = isSelected ? ' selected' : '';  // CSS class for selection styling

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

    //Update the selected indicator text with current ship information
  
    function updateSelectedIndicator(ship) {
        if (!selectedIndicator) return;
        const shipName = ship.NAME || 'Unknown';
        const category = getVesselTypeCategory(ship.TYPE);
        const mmsi = ship.MMSI || 'Unknown';
        selectedIndicator.textContent = `Selected ship: ${shipName} (${category}, MMSI ${mmsi})`;
    }

    //Clear the ship image display and show a loading message

    function clearShipImage() {
        shipImage.hidden = true;
        shipImage.src = '';
        shipImage.alt = '';
        shipImageCaption.textContent = 'Searching for a Wikidata image...';
    }

    //Display a ship image in the sidebar with source attribution

    function setShipImage(url, title) {
        shipImage.src = url;
        shipImage.alt = `Photo of ${title}`;
        shipImage.hidden = false;
        shipImageCaption.textContent = `Image source: Wikimedia Commons via Wikidata (${title})`;
    }

    //Display a fallback message when no ship image is available
     
    function showNoShipImage() {
        shipImage.hidden = true;
        shipImage.src = '';
        shipImage.alt = '';
        shipImageCaption.textContent = 'No Wikidata image found for this ship.';
    }

    //Convert a Wikimedia Commons filename to a direct image URL
 
    function commonsFileUrl(fileName) {
        // Remove 'File:' prefix if present and trim whitespace
        const normalized = String(fileName || '').replace(/^File:/i, '').trim();
        // Return null for empty strings, otherwise return the URL-encoded Commons URL
        return normalized ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(normalized)}` : null;
    }

    // Search Wikidata for a ship by IMO  number
    async function getWikidataImageByIMO(imo) {
        // SPARQL query to find a ship by IMO number (P371) and get its image (P18)
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

    // Search Wikidata for a ship by MMSI  number

    async function getWikidataImageByMMSI(mmsi) {
        //  query to find a ship by MMSI number (P587) and get its image (P18)
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

    //Search Wikidata for entities matching a text query

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

    //Retrieve image data for a Wikidata entity by its ID

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

    //Fetch and display a ship image from Wikidata
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

    //Convert AIS vessel type codes into human-readable category names

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

    // Get the marker color for a ship based on its AIS vessel type
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

    //Format ship's basic identification information for display in sidebar

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

    //Format ship's navigation information for display in sidebar

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

    // Format ship's technical information for display in sidebar

    function formatTechnicalInfo(ship) {
        return `
            <dl>
                <dt>Draught</dt><dd>${ship.DRAUGHT || 'Unknown'}</dd>
                <dt>Timestamp</dt><dd>${ship.TSTAMP || 'Unknown'}</dd>
            </dl>
        `;
    }

    //Display the sidebar 
    function showSidebar() {
        sidebar.classList.add('visible');
    }

    //Hide the sidebar by removing the visible class
    function hideSidebar() {
        sidebar.classList.remove('visible');
    }

    // event listener to close sidebar when close button is clicked
    closeSidebarButton.addEventListener('click', hideSidebar);


    // Set up tab functionality to switch between tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Add click handlers to each tab button
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            // Add active class to clicked button and its corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab') + '-tab';
            document.getElementById(tabId).classList.add('active');
        });
    });

    //Load AIS data from JSON file on page load
    fetch('ais_data.json')
        .then((response) => response.json())
        .then((ships) => {
            loadedShips = ships;
            // Performance optimization: limit number of markers rendered to avoid browser slowdown
            const maxMarkers = 400;

            // Render marker for each ship 
            ships.slice(0, maxMarkers).forEach((ship) => renderShipMarker(ship));

            // Center the map on the first ship's location if data is available
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
