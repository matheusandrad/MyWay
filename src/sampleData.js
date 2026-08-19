// Dados de Demonstração Ricos para teste imediato de todas as funções

import { interpolateGreatCircle } from './stats.js';

export function generateSampleTimeline() {
  const points = [];
  const visits = [];

  let currentTime = new Date('2024-07-01T08:00:00Z').getTime();

  // Função auxiliar para gerar caminho detalhado entre 2 pontos
  function addSegment(from, to, activity, durationMinutes, stepsCount = 60, isFlight = false) {
    const timeStep = (durationMinutes * 60 * 1000) / stepsCount;
    for (let i = 0; i <= stepsCount; i++) {
      const frac = i / stepsCount;
      let pos;
      if (isFlight) {
        pos = interpolateGreatCircle(from.lat, from.lng, to.lat, to.lng, frac);
      } else {
        // Interpolação com leve variação realista de estrada
        const baseLat = from.lat + (to.lat - from.lat) * frac;
        const baseLng = from.lng + (to.lng - from.lng) * frac;
        const jitter = Math.sin(frac * Math.PI * 4) * 0.003;
        pos = { lat: baseLat + jitter, lng: baseLng - jitter };
      }

      points.push({
        lat: pos.lat,
        lng: pos.lng,
        timestamp: currentTime + i * timeStep,
        activity: activity,
        accuracy: 10
      });
    }
    currentTime += durationMinutes * 60 * 1000;
  }

  // Locais chave
  const SAO_PAULO = { lat: -23.5505, lng: -46.6333, name: 'São Paulo (Guarulhos GRU)' };
  const LISBON = { lat: 38.7223, lng: -9.1393, name: 'Lisboa, Portugal' };
  const PORTO = { lat: 41.1579, lng: -8.6291, name: 'Porto, Portugal' };
  const MADRID = { lat: 40.4168, lng: -3.7038, name: 'Madrid, Espanha' };
  const BARCELONA = { lat: 41.3879, lng: 2.1699, name: 'Barcelona, Espanha' };
  const PARIS = { lat: 48.8566, lng: 2.3522, name: 'Paris, França' };
  const ROME = { lat: 41.9028, lng: 12.4964, name: 'Roma, Itália' };

  // 1. Início em São Paulo (Visita)
  visits.push({
    name: 'Embarque em São Paulo (GRU)',
    lat: SAO_PAULO.lat,
    lng: SAO_PAULO.lng,
    address: 'Aeroporto Internacional de Guarulhos',
    timestamp: currentTime,
    durationMs: 3 * 3600 * 1000
  });

  // 2. Voo Transatlântico SP -> Lisboa (10h)
  addSegment(SAO_PAULO, LISBON, 'FLYING', 600, 150, true);

  // 3. Chegada em Lisboa (Visita & Passeio a pé)
  visits.push({
    name: 'Torre de Belém & Alfama',
    lat: LISBON.lat,
    lng: LISBON.lng,
    address: 'Lisboa, Portugal',
    timestamp: currentTime,
    durationMs: 48 * 3600 * 1000
  });
  // Caminhada em Lisboa
  addSegment(LISBON, { lat: 38.6916, lng: -9.2159 }, 'WALKING', 90, 40);
  addSegment({ lat: 38.6916, lng: -9.2159 }, LISBON, 'IN_PASSENGER_VEHICLE', 30, 20);

  // 4. Viagem de Carro: Lisboa -> Porto
  addSegment(LISBON, PORTO, 'IN_PASSENGER_VEHICLE', 180, 80);
  visits.push({
    name: 'Ribeira do Porto',
    lat: PORTO.lat,
    lng: PORTO.lng,
    address: 'Porto, Portugal',
    timestamp: currentTime,
    durationMs: 24 * 3600 * 1000
  });

  // 5. Trem de Alta Velocidade: Porto -> Madrid
  addSegment(PORTO, MADRID, 'IN_TRAIN', 240, 100);
  visits.push({
    name: 'Plaza Mayor & Museu do Prado',
    lat: MADRID.lat,
    lng: MADRID.lng,
    address: 'Madrid, Espanha',
    timestamp: currentTime,
    durationMs: 36 * 3600 * 1000
  });

  // 6. Trem: Madrid -> Barcelona
  addSegment(MADRID, BARCELONA, 'IN_TRAIN', 160, 90);
  visits.push({
    name: 'Sagrada Família & Parc Güell',
    lat: BARCELONA.lat,
    lng: BARCELONA.lng,
    address: 'Barcelona, Catalunha, Espanha',
    timestamp: currentTime,
    durationMs: 40 * 3600 * 1000
  });

  // 7. Voo Barcelona -> Paris
  addSegment(BARCELONA, PARIS, 'FLYING', 110, 60, true);
  visits.push({
    name: 'Torre Eiffel & Museu do Louvre',
    lat: PARIS.lat,
    lng: PARIS.lng,
    address: 'Paris, França',
    timestamp: currentTime,
    durationMs: 48 * 3600 * 1000
  });

  // Passeio de bike em Paris
  addSegment(PARIS, { lat: 48.8606, lng: 2.3376 }, 'ON_BICYCLE', 45, 30);
  addSegment({ lat: 48.8606, lng: 2.3376 }, PARIS, 'WALKING', 30, 20);

  // 8. Voo Paris -> Roma
  addSegment(PARIS, ROME, 'FLYING', 120, 70, true);
  visits.push({
    name: 'Coliseu & Fontana di Trevi',
    lat: ROME.lat,
    lng: ROME.lng,
    address: 'Roma, Itália',
    timestamp: currentTime,
    durationMs: 50 * 3600 * 1000
  });

  // Retorno Voo Roma -> São Paulo
  addSegment(ROME, SAO_PAULO, 'FLYING', 720, 200, true);
  visits.push({
    name: 'Retorno ao Brasil (GRU)',
    lat: SAO_PAULO.lat,
    lng: SAO_PAULO.lng,
    address: 'São Paulo, Brasil',
    timestamp: currentTime,
    durationMs: 2 * 3600 * 1000
  });

  return {
    title: 'Minha Eurotrip 2024 (Exemplo)',
    points,
    visits,
    sourceFileName: 'Dados_Exemplo_Viagem_Europa.json'
  };
}
