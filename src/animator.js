// Motor de Animação de Alta Performance (Canvas 2D + Interpolação a 60 FPS)

import { getActivityMeta } from './stats.js';

export class TimelineAnimator {
  constructor(mapRenderer) {
    this.mapRenderer = mapRenderer;
    this.map = mapRenderer.getMapInstance();

    this.points = [];
    this.visits = [];
    this.canvas = null;
    this.ctx = null;

    // Estado da animação
    this.isPlaying = false;
    this.currentIndex = 0; // Índice decimal para interpolação suave
    this.speedMultiplier = 10;
    this.followCamera = true;
    this.animationFrameId = null;
    this.lastFrameTime = null;

    // Callbacks
    this.onProgressUpdate = null; // (progress 0..1, currentPoint, date) => {}
    this.onAnimationEnd = null;

    this.initCanvasOverlay();
  }

  initCanvasOverlay() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'animation-canvas-layer';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '450';

    // Adiciona o canvas no pane do mapa
    const pane = this.map.getPanes().overlayPane;
    pane.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Sincroniza o tamanho do canvas e redesenha ao mover o mapa
    const resizeCanvas = () => {
      const size = this.map.getSize();
      const pixelRatio = window.devicePixelRatio || 1;
      this.canvas.width = size.x * pixelRatio;
      this.canvas.height = size.y * pixelRatio;
      this.canvas.style.width = `${size.x}px`;
      this.canvas.style.height = `${size.y}px`;
      this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      // Reposiciona o canvas no canto superior esquerdo do mapa
      const topLeft = this.map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this.canvas, topLeft);

      if (!this.isPlaying && this.points.length > 0) {
        this.renderFrame(this.currentIndex);
      }
    };

    this.map.on('move', () => {
      const topLeft = this.map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this.canvas, topLeft);
      if (!this.isPlaying && this.points.length > 0) {
        this.renderFrame(this.currentIndex);
      }
    });

    this.map.on('resize', resizeCanvas);
    this.map.on('zoom', resizeCanvas);
    resizeCanvas();
  }

  setTimelineData(points, visits = []) {
    this.points = points || [];
    this.visits = visits || [];
    this.currentIndex = 0;
    this.stop();
    this.clearCanvas();
  }

  clearCanvas() {
    if (!this.ctx) return;
    const size = this.map.getSize();
    this.ctx.clearRect(0, 0, size.x, size.y);
  }

  play() {
    if (this.points.length === 0) return;
    if (this.currentIndex >= this.points.length - 1) {
      this.currentIndex = 0;
    }
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  pause() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  stop() {
    this.pause();
    this.currentIndex = 0;
    this.clearCanvas();
  }

  seek(progressFraction) {
    if (this.points.length === 0) return;
    const clamped = Math.max(0, Math.min(1, progressFraction));
    this.currentIndex = clamped * (this.points.length - 1);
    this.renderFrame(this.currentIndex);

    if (this.followCamera) {
      const curr = this.getCurrentInterpolatedPoint(this.currentIndex);
      if (curr) {
        this.map.panTo([curr.lat, curr.lng], { animate: false });
      }
    }
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Number(multiplier) || 10;
  }

  setFollowCamera(shouldFollow) {
    this.followCamera = !!shouldFollow;
  }

  loop(currentTime) {
    if (!this.isPlaying) return;

    const deltaMs = currentTime - (this.lastFrameTime || currentTime);
    this.lastFrameTime = currentTime;

    // Avança o índice baseado no tempo e multiplicador de velocidade
    // 60 pontos base por segundo com multiplicador
    const step = (deltaMs / 1000) * (this.points.length / 30) * (this.speedMultiplier / 10);
    this.currentIndex += Math.max(step, 0.05);

    if (this.currentIndex >= this.points.length - 1) {
      this.currentIndex = this.points.length - 1;
      this.renderFrame(this.currentIndex);
      this.pause();
      if (this.onAnimationEnd) this.onAnimationEnd();
      return;
    }

    this.renderFrame(this.currentIndex);

    // Câmera seguidora suave
    if (this.followCamera) {
      const currentPoint = this.getCurrentInterpolatedPoint(this.currentIndex);
      if (currentPoint) {
        const center = this.map.getCenter();
        const dist = Math.hypot(center.lat - currentPoint.lat, center.lng - currentPoint.lng);
        // Atualiza a câmera se mover um mínimo para não travar
        if (dist > 0.005) {
          this.map.panTo([currentPoint.lat, currentPoint.lng], {
            animate: true,
            duration: 0.15,
            easeLinearity: 0.5
          });
        }
      }
    }

    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  getCurrentInterpolatedPoint(index) {
    const idxFloor = Math.floor(index);
    const idxCeil = Math.min(idxFloor + 1, this.points.length - 1);
    const frac = index - idxFloor;

    const p1 = this.points[idxFloor];
    const p2 = this.points[idxCeil];
    if (!p1 || !p2) return p1 || null;

    return {
      lat: p1.lat + (p2.lat - p1.lat) * frac,
      lng: p1.lng + (p2.lng - p1.lng) * frac,
      timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * frac,
      activity: p2.activity || p1.activity || 'DESCONHECIDO'
    };
  }

  renderFrame(index) {
    if (this.points.length === 0 || !this.ctx) return;

    const size = this.map.getSize();
    this.ctx.clearRect(0, 0, size.x, size.y);

    const intIndex = Math.min(Math.floor(index), this.points.length - 1);
    const currentPt = this.getCurrentInterpolatedPoint(index);

    // 1. Desenha a trilha percorrida até agora
    this.ctx.beginPath();
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Gradiente brilhante para a cauda
    const headPixel = this.map.latLngToContainerPoint([currentPt.lat, currentPt.lng]);

    for (let i = 0; i <= intIndex; i++) {
      const p = this.points[i];
      const pix = this.map.latLngToContainerPoint([p.lat, p.lng]);
      if (i === 0) {
        this.ctx.moveTo(pix.x, pix.y);
      } else {
        this.ctx.lineTo(pix.x, pix.y);
      }
    }
    this.ctx.lineTo(headPixel.x, headPixel.y);

    this.ctx.strokeStyle = '#06b6d4'; // Ciano neon
    this.ctx.shadowColor = '#38bdf8';
    this.ctx.shadowBlur = 12;
    this.ctx.stroke();

    // 2. Cauda recente com brilho ainda mais forte
    const tailLength = Math.min(intIndex, 25);
    if (tailLength > 0) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 6;
      const startTail = Math.max(0, intIndex - tailLength);
      for (let i = startTail; i <= intIndex; i++) {
        const p = this.points[i];
        const pix = this.map.latLngToContainerPoint([p.lat, p.lng]);
        if (i === startTail) this.ctx.moveTo(pix.x, pix.y);
        else this.ctx.lineTo(pix.x, pix.y);
      }
      this.ctx.lineTo(headPixel.x, headPixel.y);
      this.ctx.strokeStyle = '#ec4899'; // Rosa neon na ponta
      this.ctx.shadowColor = '#f43f5e';
      this.ctx.shadowBlur = 16;
      this.ctx.stroke();
    }

    // 3. Desenha o Marcador do Ponto Atual (Cabeça luminosa pulsante)
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#38bdf8';

    // Anel externo pulsante
    this.ctx.beginPath();
    this.ctx.arc(headPixel.x, headPixel.y, 14, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    this.ctx.fill();

    // Círculo central
    this.ctx.beginPath();
    this.ctx.arc(headPixel.x, headPixel.y, 7, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();

    // Reseta sombras
    this.ctx.shadowBlur = 0;

    // Dispara atualização de progresso para a UI externa
    if (this.onProgressUpdate) {
      const progress = this.points.length > 1 ? index / (this.points.length - 1) : 0;
      this.onProgressUpdate(progress, currentPt, new Date(currentPt.timestamp));
    }
  }

  getCanvasElement() {
    return this.canvas;
  }
}
