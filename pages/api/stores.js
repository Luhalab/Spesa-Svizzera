// Trova i negozi Migros / Coop / Denner / Aldi più vicini usando
// OpenStreetMap tramite Overpass API — dati pubblici, nessuna chiave richiesta.

const BRAND_TAGS = {
  migros: "Migros",
  coop: "Coop",
  denner: "Denner",
  aldi: "Aldi",
};

export default async function handler(req, res) {
  const { lat, lng, radius = 3000 } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "Parametri 'lat' e 'lng' mancanti" });
  }

  const brandFilter = Object.values(BRAND_TAGS)
    .map((b) => `node["shop"~"supermarket|convenience"]["name"~"${b}",i](around:${radius},${lat},${lng});`)
    .join("\n");

  const query = `[out:json][timeout:15];(${brandFilter});out body;`;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain" },
    });
    const data = await response.json();

    const stores = (data.elements || []).map((el) => ({
      id: el.id,
      name: el.tags?.name || "Negozio",
      lat: el.lat,
      lng: el.lon,
      distanceKm: haversine(lat, lng, el.lat, el.lon),
    }));

    stores.sort((a, b) => a.distanceKm - b.distanceKm);
    return res.status(200).json({ stores });
  } catch (err) {
    console.error("Errore Overpass API:", err.message);
    return res.status(502).json({ error: "Overpass API non raggiungibile" });
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
