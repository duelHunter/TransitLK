/** Leaflet page for the WebView; the app moves the bus by injecting buildMoveScript(...). */
export function buildMapHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map').setView([7.5, 80.5], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
var marker = null;
window.moveBus = function (lat, lon) {
  if (!marker) {
    marker = L.marker([lat, lon]).addTo(map);
    map.setView([lat, lon], 12);
  } else {
    marker.setLatLng([lat, lon]);
    map.panTo([lat, lon]);
  }
};
</script>
</body>
</html>`;
}

export function buildMoveScript(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return `window.moveBus(${lat}, ${lon}); true;`;
}
