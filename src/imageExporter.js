// Módulo de Exportação de Imagem em Alta Resolução (com Mapa Real ao Fundo + Zero CORS Taint)

import { formatDuration, getActivityMeta } from './stats.js';

/**
 * Carrega azulejo do mapa de forma segura com CORS para não contaminar o Canvas
 */
async function loadTileBitmap(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch (err) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
}

export async function exportTimelineImage(mapInstance, stats, title = 'Minhas Viagens', points = [], visits = []) {
  const exportCanvas = document.createElement('canvas');
  const width = 1200;
  const height = 1400;
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d');

  function roundRect(c, x, y, w, h, r) {
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
  }

  // 1. Fundo Gradiente Escuro Sofisticado
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#060a14');
  bgGrad.addColorStop(0.5, '#0b1120');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Cabeçalho
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px "Outfit", "Inter", sans-serif';
  ctx.fillText('MYWAY • GOOGLE TIMELINE RECAP', 60, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px "Outfit", "Inter", sans-serif';
  ctx.fillText(title || 'Minhas Viagens', 60, 125);

  const dateStr =
    stats.dateRange?.start && stats.dateRange?.end
      ? `${stats.dateRange.start.toLocaleDateString('pt-BR')} até ${stats.dateRange.end.toLocaleDateString('pt-BR')}`
      : 'Histórico Completo';

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 18px "Outfit", "Inter", sans-serif';
  ctx.fillText(`📅 ${dateStr}`, 60, 165);

  // 3. Área do Mapa
  const mapWidth = 1080;
  const mapHeight = 820;
  const mapX = 60;
  const mapY = 200;

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, mapX, mapY, mapWidth, mapHeight, 20);
  ctx.clip();

  // Fundo base do mapa
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(mapX, mapY, mapWidth, mapHeight);

  // Carrega e desenha TODOS os azulejos reais do mapa (ruas, cidades, relevo)
  const mapContainer = mapInstance.getContainer();
  const mapRect = mapContainer.getBoundingClientRect();
  const tileElements = Array.from(mapContainer.querySelectorAll('img.leaflet-tile'));

  const tilePromises = tileElements.map(async (img) => {
    if (!img.src) return;
    const imgRect = img.getBoundingClientRect();
    const destX = mapX + (imgRect.left - mapRect.left) * (mapWidth / mapRect.width);
    const destY = mapY + (imgRect.top - mapRect.top) * (mapHeight / mapRect.height);
    const destW = imgRect.width * (mapWidth / mapRect.width);
    const destH = imgRect.height * (mapHeight / mapRect.height);

    const bitmap = await loadTileBitmap(img.src);
    if (bitmap) {
      ctx.drawImage(bitmap, destX, destY, destW, destH);
    }
  });

  // Aguarda todos os azulejos serem renderizados no canvas
  await Promise.all(tilePromises);

  // Renderização vetorial precisa das rotas por cima do mapa real
  if (points && points.length > 0) {
    // 1. Trilha Glow de fundo
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    points.forEach((p, idx) => {
      const pix = mapInstance.latLngToContainerPoint([p.lat, p.lng]);
      const dx = mapX + (pix.x / mapRect.width) * mapWidth;
      const dy = mapY + (pix.y / mapRect.height) * mapHeight;
      if (idx === 0) ctx.moveTo(dx, dy);
      else ctx.lineTo(dx, dy);
    });

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();

    // 2. Linha principal do trajeto
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    points.forEach((p, idx) => {
      const pix = mapInstance.latLngToContainerPoint([p.lat, p.lng]);
      const dx = mapX + (pix.x / mapRect.width) * mapWidth;
      const dy = mapY + (pix.y / mapRect.height) * mapHeight;
      if (idx === 0) ctx.moveTo(dx, dy);
      else ctx.lineTo(dx, dy);
    });

    ctx.strokeStyle = '#06b6d4';
    ctx.stroke();
    ctx.restore();

    // 3. Marcador de Ponto de Partida
    const startPt = points[0];
    const startPix = mapInstance.latLngToContainerPoint([startPt.lat, startPt.lng]);
    const sX = mapX + (startPix.x / mapRect.width) * mapWidth;
    const sY = mapY + (startPix.y / mapRect.height) * mapHeight;

    ctx.save();
    ctx.beginPath();
    ctx.arc(sX, sY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 4. Marcador de Destino Final
    const endPt = points[points.length - 1];
    const endPix = mapInstance.latLngToContainerPoint([endPt.lat, endPt.lng]);
    const eX = mapX + (endPix.x / mapRect.width) * mapWidth;
    const eY = mapY + (endPix.y / mapRect.height) * mapHeight;

    ctx.save();
    ctx.beginPath();
    ctx.arc(eX, eY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ec4899';
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 5. Marcadores de Paradas / Visitas com números
    if (visits && visits.length > 0) {
      visits.slice(0, 60).forEach((v, index) => {
        const vPix = mapInstance.latLngToContainerPoint([v.lat, v.lng]);
        const vx = mapX + (vPix.x / mapRect.width) * mapWidth;
        const vy = mapY + (vPix.y / mapRect.height) * mapHeight;

        if (vx >= mapX && vx <= mapX + mapWidth && vy >= mapY && vy <= mapY + mapHeight) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(vx, vy, 11, 0, Math.PI * 2);
          ctx.fillStyle = '#a855f7';
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Número dentro da badge
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px "Outfit", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((index + 1).toString(), vx, vy);
          ctx.restore();
        }
      });
    }
  }

  ctx.restore();

  // Borda brilhante ao redor do mapa
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  roundRect(ctx, mapX, mapY, mapWidth, mapHeight, 20);
  ctx.stroke();
  ctx.restore();

  // 4. Cartões de Estatísticas no Rodapé
  const statsY = 1060;
  const cardWidth = 330;
  const cardHeight = 160;
  const gap = 45;

  const statCards = [
    {
      label: 'DISTÂNCIA TOTAL',
      value: `${(stats.totalDistanceKm || 0).toLocaleString('pt-BR')} km`,
      icon: '🚀',
      color: '#38bdf8'
    },
    {
      label: 'TEMPO EM VIAGEM',
      value: formatDuration(stats.totalDurationMs),
      icon: '⏱️',
      color: '#a855f7'
    },
    {
      label: 'LOCAIS VISITADOS',
      value: `${stats.totalVisits || 0} paradas`,
      icon: '📍',
      color: '#ec4899'
    }
  ];

  statCards.forEach((card, i) => {
    const cx = mapX + i * (cardWidth + gap);

    ctx.save();
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, cx, statsY, cardWidth, cardHeight, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = card.color;
    ctx.font = 'bold 15px "Outfit", sans-serif';
    ctx.fillText(`${card.icon}  ${card.label}`, cx + 24, statsY + 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Outfit", sans-serif';
    ctx.fillText(card.value, cx + 24, statsY + 105);

    ctx.restore();
  });

  // 5. Rodapé / Assinatura
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.font = '16px "Outfit", sans-serif';
  ctx.fillText('Gerado localmente com MyWay Timeline Visualizer • 100% Privado', 60, 1340);

  // 6. Download Seguro
  exportCanvas.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `MyWay-Timeline-${Date.now()}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }, 'image/png');
}
