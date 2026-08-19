// Módulo de Gerenciamento do Mapa (Leaflet + Camadas Estilizadas)

import { getActivityMeta } from './stats.js';

export class MapRenderer {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.tileLayers = {};
    this.currentTileLayer = null;
    this.routeLayerGroup = null;
    this.markersLayerGroup = null;
    this.canvasLayer = null;

    this.initMap();
  }

  initMap() {
    // Inicializa o mapa com visão global padrão
    this.map = L.map(this.containerId, {
      center: [20, 0],
      zoom: 3,
      zoomControl: false,
      attributionControl: false
    });

    // Adiciona controle de zoom no canto superior direito
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Camadas de mapa (Dark Matter é o padrão visual premium)
    this.tileLayers = {
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }),
      voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18
      })
    };

    this.setTheme('dark');

    // Grupos de camadas para fácil limpeza e atualização
    this.routeLayerGroup = L.layerGroup().addTo(this.map);
    this.markersLayerGroup = L.layerGroup().addTo(this.map);
  }

  setTheme(themeName) {
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }
    const layer = this.tileLayers[themeName] || this.tileLayers.dark;
    layer.addTo(this.map);
    this.currentTileLayer = layer;
  }

  clearAll() {
    this.routeLayerGroup.clearLayers();
    this.markersLayerGroup.clearLayers();
  }

  /**
   * Desenha toda a timeline (visão estática completa) no mapa com gradientes e marcadores
   */
  renderTimeline(points, visits = []) {
    this.clearAll();

    if (!points || points.length === 0) return;

    const latLngs = points.map((p) => [p.lat, p.lng]);

    // Linha de fundo com brilho neon suave
    const glowLine = L.polyline(latLngs, {
      color: '#38bdf8',
      weight: 6,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    });
    this.routeLayerGroup.addLayer(glowLine);

    // Linha principal do trajeto
    const mainLine = L.polyline(latLngs, {
      color: '#06b6d4',
      weight: 3.5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    });
    this.routeLayerGroup.addLayer(mainLine);

    // Adiciona marcadores de início e fim
    const startPoint = points[0];
    const endPoint = points[points.length - 1];

    this.addWaypointMarker(startPoint.lat, startPoint.lng, '🚀 Ponto de Partida', '#10b981');
    this.addWaypointMarker(endPoint.lat, endPoint.lng, '🏁 Destino Final', '#ec4899');

    // Adiciona marcadores para locais visitados significativos
    visits.forEach((v, index) => {
      this.addVisitMarker(v, index + 1);
    });

    // Enquadra a câmera em todos os pontos
    this.fitPoints(points);
  }

  addWaypointMarker(lat, lng, title, color) {
    const icon = L.divIcon({
      className: 'custom-map-marker',
      html: `<div class="marker-pulse" style="background-color: ${color}; box-shadow: 0 0 16px ${color};"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([lat, lng], { icon })
      .bindPopup(`<div class="map-popup"><strong>${title}</strong><br><small>${lat.toFixed(4)}, ${lng.toFixed(4)}</small></div>`);
    this.markersLayerGroup.addLayer(marker);
  }

  addVisitMarker(visit, index) {
    const icon = L.divIcon({
      className: 'custom-visit-marker',
      html: `
        <div class="visit-badge">
          <span class="badge-num">${index}</span>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const dateStr = visit.timestamp ? new Date(visit.timestamp).toLocaleDateString() : '';
    const marker = L.marker([visit.lat, visit.lng], { icon }).bindPopup(`
      <div class="map-popup">
        <h4 style="margin: 0 0 4px 0; color: #38bdf8;">${visit.name}</h4>
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #cbd5e1;">${visit.address || ''}</p>
        <span style="font-size: 11px; color: #94a3b8;">📅 ${dateStr}</span>
      </div>
    `);

    this.markersLayerGroup.addLayer(marker);
  }

  fitPoints(points) {
    if (!points || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    this.map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 15,
      animate: true,
      duration: 1
    });
  }

  getMapInstance() {
    return this.map;
  }
}
