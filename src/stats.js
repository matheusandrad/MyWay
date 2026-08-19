// Módulo de Estatísticas e Métricas Geográficas

/**
 * Calcula a distância em km entre dois pontos geográficos usando a fórmula de Haversine
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Interpolação Great-Circle (geodésica) para curvas de voo
 */
export function interpolateGreatCircle(lat1, lon1, lat2, lon2, fraction) {
  const p1 = (lat1 * Math.PI) / 180;
  const l1 = (lon1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const l2 = (lon2 * Math.PI) / 180;

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.pow(Math.sin((p1 - p2) / 2), 2) +
          Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin((l1 - l2) / 2), 2)
      )
    );

  if (d === 0) return { lat: lat1, lng: lon1 };

  const A = Math.sin((1 - fraction) * d) / Math.sin(d);
  const B = Math.sin(fraction * d) / Math.sin(d);

  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
  const z = A * Math.sin(p1) + B * Math.sin(p2);

  const lat = (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI;
  const lng = (Math.atan2(y, x) * 180) / Math.PI;

  return { lat, lng };
}

/**
 * Calcula todas as métricas detalhadas a partir dos pontos processados
 */
export function computeTimelineStats(points, visits = []) {
  if (!points || points.length === 0) {
    return {
      totalDistanceKm: 0,
      totalDurationMs: 0,
      totalPoints: 0,
      totalVisits: visits.length,
      activityBreakdown: {},
      dateRange: { start: null, end: null },
      topSpeedKmh: 0,
      avgSpeedKmh: 0
    };
  }

  let totalDistance = 0;
  let totalTimeMs = 0;
  let maxSpeed = 0;
  const activityDistances = {};

  const startTime = points[0].timestamp;
  const endTime = points[points.length - 1].timestamp;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dist = calculateHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    totalDistance += dist;

    const timeDiffHours = Math.max((p2.timestamp - p1.timestamp) / (1000 * 60 * 60), 0.0001);
    const speed = dist / timeDiffHours;
    if (speed < 1200 && speed > maxSpeed) {
      maxSpeed = speed;
    }

    const act = p2.activity || 'DESCONHECIDO';
    activityDistances[act] = (activityDistances[act] || 0) + dist;
  }

  totalTimeMs = Math.max(endTime - startTime, 0);
  const totalHours = totalTimeMs / (1000 * 60 * 60);
  const avgSpeed = totalHours > 0 ? totalDistance / totalHours : 0;

  return {
    totalDistanceKm: Math.round(totalDistance * 10) / 10,
    totalDurationMs: totalTimeMs,
    totalHours: Math.round(totalHours * 10) / 10,
    totalPoints: points.length,
    totalVisits: visits.length,
    activityBreakdown: activityDistances,
    dateRange: {
      start: new Date(startTime),
      end: new Date(endTime)
    },
    topSpeedKmh: Math.round(maxSpeed),
    avgSpeedKmh: Math.round(avgSpeed * 10) / 10
  };
}

/**
 * Formata durações em texto amigável
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '0h';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (days > 0) {
    return `${days}d ${remHours}h`;
  }
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

/**
 * Tradução e ícone de atividades
 */
export function getActivityMeta(activityType) {
  const map = {
    IN_PASSENGER_VEHICLE: { label: 'Carro/Veículo', icon: '🚗', color: '#38bdf8' },
    IN_VEHICLE: { label: 'Veículo', icon: '🚗', color: '#38bdf8' },
    IN_BUS: { label: 'Ônibus', icon: '🚌', color: '#fb923c' },
    IN_TRAIN: { label: 'Trem/Metrô', icon: '🚆', color: '#a855f7' },
    IN_SUBWAY: { label: 'Metrô', icon: '🚇', color: '#a855f7' },
    FLYING: { label: 'Voo/Avião', icon: '✈️', color: '#f43f5e' },
    ON_BICYCLE: { label: 'Bicicleta', icon: '🚲', color: '#10b981' },
    WALKING: { label: 'A pé', icon: '🚶', color: '#4ade80' },
    RUNNING: { label: 'Corrida', icon: '🏃', color: '#eab308' },
    MOTORCYCLING: { label: 'Moto', icon: '🏍️', color: '#06b6d4' },
    SAILING: { label: 'Barco/Balsa', icon: '⛵', color: '#0284c7' },
    STILL: { label: 'Parado', icon: '📍', color: '#94a3b8' },
    UNKNOWN: { label: 'Deslocamento', icon: '📍', color: '#6366f1' },
    DESCONHECIDO: { label: 'Deslocamento', icon: '📍', color: '#6366f1' }
  };
  return map[activityType] || { label: activityType || 'Deslocamento', icon: '📍', color: '#6366f1' };
}
