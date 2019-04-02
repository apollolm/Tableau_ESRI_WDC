# Tableau_ESRI_WDC
A hackathon Web Data Connector (WDC) to pull data from ArcGIS Server into Tableau.
Also includes a WDC for Mapbox Enterprise Acount Analytics API.

## Requirements
You'll need to install Node.js (A recent version will do.  v8 on my dev machine.  v11 on a staging machine.)

## Setup
Clone the repo.

Run `npm install`

To run the server, use `npm start`

3 web services should start:

1. The web server on port `8888` hosts the .html and .js pages that are displayed inside of Tableau and contain the logic to fetch the data.
2. An HTTPS proxy on port `8889` is for dev purposes only and will forward HTTPS requests to an HTTPS server to get around CORS restrictions.
3. An HTTP proxy on port `8890` is for dev purposes only and will forward HTTP requests to HTTP servers to get around CORS restrictions.

These ports can be changed in the `package.json` file and are referenced in the arcgis-server.js file.

At this point, you should be able to hit http://localhost:8888/arcgis-server.html and see the page.

