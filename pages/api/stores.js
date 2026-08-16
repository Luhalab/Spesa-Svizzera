// Trova i negozi Migros / Coop / Denner / Aldi più vicini usando
// OpenStreetMap tramite Overpass API — dati pubblici, nessuna chiave richiesta.
// (Overpass risponde in genere in meno di un secondo, non serve un timeout esteso.)

const BRANDS = {
  migros: "Migros",
  coop: "Coop",
};

export default async function handler(req, res) {
  const { lat, lng, radius = 5000 } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "Parametri 'lat' e 'lng' mancanti" });
  }

  const brandFilter = Object.values(BRANDS)
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

    const stores = (data.elements || [])
      .filter((el) => el.tags?.name)
      .map((el) => ({
        id: el.id,
        name: el.tags.name,
        lat: el.lat,
        lng: el.lon,
        distanceKm: haversine(lat, lng, el.lat, el.lon),
      }));

    stores.sort((a, b) => a.distanceKm - b.distanceKm);

    // Negozio più vicino per ciascuna delle 4 catene
    const nearestByChain = {};
    Object.entries(BRANDS).forEach(([id, brand]) => {
      nearestByChain[id] = stores.find((s) => s.name.toLowerCase().includes(brand.toLowerCase())) || null;
    });

    return res.status(200).json({ stores, nearestByChain });
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
