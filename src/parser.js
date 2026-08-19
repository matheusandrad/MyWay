// Parser Universal e Robusto para dados do Google Timeline / Google Takeout / Android 2024-2026

import { calculateHaversineDistance } from './stats.js';

/**
 * Converte qualquer representação de coordenada em número decimal válido {lat, lng} ou float
 */
export function normalizeCoord(val) {
  if (val === undefined || val === null) return null;

  if (typeof val === 'number') {
    if (Math.abs(val) > 180) return val / 1e7;
    return val;
  }

  if (typeof val === 'string') {
    let clean = val.replace(/°/g, '').replace(/geo:/gi, '').trim();
    if (clean.includes(',')) {
      const parts = clean.split(',');
      const lat = normalizeCoord(parts[0].trim());
      const lng = normalizeCoord(parts[1].trim());
      if (lat !== null && lng !== null) {
        return { lat, lng };
      }
      return null;
    }
    const num = parseFloat(clean);
    if (!isNaN(num)) {
      if (Math.abs(num) > 180) return num / 1e7;
      return num;
    }
  }

  if (typeof val === 'object') {
    return extractLatLng(val);
  }

  return null;
}

/**
 * Converte timestamp (ISO string, epoch ms ou epoch s) para Epoch Milissegundos
 */
export function normalizeTimestamp(val) {
  if (!val) return Date.now();
  if (typeof val === 'number') {
    if (val < 10000000000) return val * 1000;
    return val;
  }
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num)) {
      if (num < 10000000000) return num * 1000;
      return num;
    }
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

/**
 * Extrai pares {lat, lng} de objetos com coordenadas variadas
 */
export function extractLatLng(obj) {
  if (!obj) return null;

  // Formato direto de lat/lng decimais ou E7
  let lat = obj.latitude !== undefined ? obj.latitude : (obj.lat !== undefined ? obj.lat : obj.latitudeE7);
  let lng = obj.longitude !== undefined ? obj.longitude : (obj.lng !== undefined ? obj.lng : obj.longitudeE7);

  if (lat !== undefined && lng !== undefined) {
    const nLat = normalizeCoord(lat);
    const nLng = normalizeCoord(lng);
    if (nLat !== null && nLng !== null && !isNaN(nLat) && !isNaN(nLng)) {
      return { lat: nLat, lng: nLng };
    }
  }

  // Formato string de graus: "latLng": "-29.7281459°, -52.4345834°"
  if (obj.latLng) {
    const res = normalizeCoord(obj.latLng);
    if (res && res.lat !== undefined && res.lng !== undefined) return res;
  }

  // Formato string "point": "-29.728135°, -52.4347423°"
  if (obj.point) {
    const res = normalizeCoord(obj.point);
    if (res && res.lat !== undefined && res.lng !== undefined) return res;
  }

  // Formato placeLocation / location aninhado
  if (obj.placeLocation) {
    return extractLatLng(obj.placeLocation);
  }
  if (obj.location) {
    return extractLatLng(obj.location);
  }

  if (obj.centerLatE7 !== undefined && obj.centerLngE7 !== undefined) {
    return {
      lat: normalizeCoord(obj.centerLatE7),
      lng: normalizeCoord(obj.centerLngE7)
    };
  }

  return null;
}

/**
 * Traduz tipo semântico do Google para nome amigável
 */
function translateSemanticType(type) {
  const map = {
    INFERRED_HOME: 'Casa 🏠',
    INFERRED_WORK: 'Trabalho 💼',
    SEARCHED_ADDRESS: 'Endereço Pesquisado 🔍',
    ALIASED_LOCATION: 'Local Salvo ⭐',
    UNKNOWN: 'Local Visitado 📍'
  };
  return map[type] || 'Local Visitado 📍';
}

/**
 * Parser principal universal que aceita qualquer JSON de histórico do Google
 */
export function parseGoogleTimelineJSON(rawJsonData) {
  let data = rawJsonData;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      throw new Error('Formato JSON inválido. Verifique o arquivo enviado.');
    }
  }

  const rawPoints = [];
  const visits = [];

  let items = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (data.semanticSegments && Array.isArray(data.semanticSegments)) {
    items = data.semanticSegments;
  } else if (data.timelineObjects && Array.isArray(data.timelineObjects)) {
    items = data.timelineObjects;
  } else if (data.locations && Array.isArray(data.locations)) {
    items = data.locations;
  } else if (data.rawSignals && Array.isArray(data.rawSignals)) {
    items = data.rawSignals;
  } else {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 0) {
        items = data[key];
        break;
      }
    }
  }

  if (!items || items.length === 0) {
    throw new Error('Nenhum registro de localização encontrado no arquivo JSON fornecido.');
  }

  for (const item of items) {
    // Caso 1: Item possui array "timelinePath" (Formato nativo mais recente de exportação)
    if (item.timelinePath && Array.isArray(item.timelinePath)) {
      for (const pt of item.timelinePath) {
        const coord = extractLatLng(pt) || normalizeCoord(pt.point);
        if (coord && coord.lat !== undefined && coord.lng !== undefined) {
          rawPoints.push({
            lat: coord.lat,
            lng: coord.lng,
            timestamp: normalizeTimestamp(pt.time || item.startTime),
            accuracy: 10,
            activity: 'DESCONHECIDO'
          });
        }
      }
    }

    // Caso 2: Activity Segment (Deslocamento)
    const activity = item.activity || item.activitySegment;
    if (activity) {
      const activityType = activity.topCandidate?.type || activity.activityType || 'IN_PASSENGER_VEHICLE';
      const startT = normalizeTimestamp(activity.startTime || item.startTime);
      const endT = normalizeTimestamp(activity.endTime || item.endTime);

      const startCoord = extractLatLng(activity.start) || extractLatLng(activity.startLocation);
      const endCoord = extractLatLng(activity.end) || extractLatLng(activity.endLocation);

      if (startCoord) {
        rawPoints.push({
          lat: startCoord.lat,
          lng: startCoord.lng,
          timestamp: startT,
          activity: activityType,
          accuracy: 15
        });
      }

      // Waypoint paths / sub-trajetos
      const subPoints =
        activity.waypointPath?.waypoints ||
        activity.simplifiedRawPath?.points ||
        activity.transitPath?.transitStops ||
        [];

      if (subPoints.length > 0) {
        const total = subPoints.length;
        const timeInterval = (endT - startT) / Math.max(total, 1);
        subPoints.forEach((pt, idx) => {
          const coord = extractLatLng(pt);
          if (coord) {
            rawPoints.push({
              lat: coord.lat,
              lng: coord.lng,
              timestamp: startT + idx * timeInterval,
              activity: activityType,
              accuracy: 10
            });
          }
        });
      }

      if (endCoord) {
        rawPoints.push({
          lat: endCoord.lat,
          lng: endCoord.lng,
          timestamp: endT,
          activity: activityType,
          accuracy: 15
        });
      }
    }

    // Caso 3: Visit (Parada / Local Visitado)
    const visit = item.visit || item.placeVisit;
    if (visit) {
      const topCand = visit.topCandidate || {};
      const coord =
        extractLatLng(topCand.placeLocation) ||
        extractLatLng(topCand.location) ||
        extractLatLng(visit.location) ||
        extractLatLng(visit.candidateLocations?.[0]);

      const startT = normalizeTimestamp(item.startTime || visit.duration?.startTimestamp);
      const endT = normalizeTimestamp(item.endTime || visit.duration?.endTimestamp);

      if (coord) {
        const placeName =
          topCand.semanticType ? translateSemanticType(topCand.semanticType) :
          (visit.location?.name || 'Local Visitado');

        visits.push({
          name: placeName,
          address: topCand.placeId ? `ID: ${topCand.placeId}` : '',
          lat: coord.lat,
          lng: coord.lng,
          timestamp: startT,
          durationMs: Math.max(endT - startT, 0)
        });

        rawPoints.push({
          lat: coord.lat,
          lng: coord.lng,
          timestamp: startT,
          activity: 'STILL',
          accuracy: 5
        });
      }
    }

    // Caso 4: Records.json / Coordenada direta
    if (item.latitudeE7 !== undefined || item.latitude !== undefined) {
      const coord = extractLatLng(item);
      if (coord) {
        rawPoints.push({
          lat: coord.lat,
          lng: coord.lng,
          timestamp: normalizeTimestamp(item.timestamp || item.timestampMs),
          accuracy: item.accuracy || 10,
          activity: item.activity ? (item.activity[0]?.activity?.[0]?.type || 'DESCONHECIDO') : 'DESCONHECIDO'
        });
      }
    }
  }

  // Ordena cronologicamente
  rawPoints.sort((a, b) => a.timestamp - b.timestamp);

  // Aplica filtro de ruído GPS
  const filteredPoints = filterGpsOutliers(rawPoints);

  if (filteredPoints.length === 0) {
    throw new Error('Nenhum ponto válido de localização foi extraído após a filtragem.');
  }

  return {
    points: filteredPoints,
    visits: visits
  };
}

/**
 * Remove saltos de GPS anômalos (teleporte momentâneo / ruído de sinal)
 */
export function filterGpsOutliers(points) {
  if (points.length <= 2) return points;

  const clean = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = clean[clean.length - 1];
    const curr = points[i];

    if (curr.timestamp === prev.timestamp && curr.lat === prev.lat && curr.lng === prev.lng) {
      continue;
    }

    const distKm = calculateHaversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    const timeHours = Math.max((curr.timestamp - prev.timestamp) / (1000 * 3600), 0.00001);
    const speedKmh = distKm / timeHours;

    if (speedKmh > 1250 && curr.activity !== 'FLYING') {
      if (i + 1 < points.length) {
        const next = points[i + 1];
        const distToNext = calculateHaversineDistance(prev.lat, prev.lng, next.lat, next.lng);
        if (distToNext < 100) {
          continue;
        }
      }
    }

    clean.push(curr);
  }

  return clean;
}
