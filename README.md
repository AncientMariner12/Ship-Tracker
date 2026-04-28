# Ship-Tracker

A Leaflet-based web application for tracking and visualizing ships using AIS (Automatic Identification System) data.

 * Features include:
 * - Interactive map with ship markers color-coded by vessel type
 * - Ship details panel with multiple information tabs
 * - Add new ships manually to the map
 * - Download AIS data as JSON
 * - Search for ship images via Wikidata
 * - User location tracking

 AIS Data is stored in the data_data.json file the data used can be updated by updating the content of this fle or replaceing the file with one of the same name and same json data format

## Attribution

This project uses data and services from the following sources:

- **OpenStreetMap**: Map data and tiles provided by [OpenStreetMap](https://www.openstreetmap.org/) contributors and [Carto](https://carto.com/), under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
- **Geolocation API**: User location provided by the [W3C Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) built into modern browsers.
- **Wikidata & Wikimedia Commons**: Ship images and metadata sourced from [Wikidata](https://www.wikidata.org/) and [Wikimedia Commons](https://commons.wikimedia.org/), under the [Creative Commons licenses](https://creativecommons.org/licenses/).

## To run the program please make sure that the browser allows webapps to acess files or there will be no ship data

### Running on a Localhost Server

If your browser blocks local file access, you can run Ship-Tracker on a simple localhost server. The easiest way is to use Python:

For Python 3.x:

```sh
python -m http.server 8000
```

Then open your browser and go to [http://localhost:8000](http://localhost:8000)

For Python 2.x:

```sh
python -m SimpleHTTPServer 8000
```

This will serve the project files from the current directory. Make sure you run the command in the Ship-Tracker folder.