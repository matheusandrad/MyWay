// Ponto de Entrada da Aplicação e Orquestrador Principal

import { parseGoogleTimelineJSON, filterTimelineByDateRange } from './parser.js';
import { generateSampleTimeline } from './sampleData.js';
import { computeTimelineStats, formatDuration, getActivityMeta } from './stats.js';
import { MapRenderer } from './mapRenderer.js';
import { TimelineAnimator } from './animator.js';
import { exportTimelineImage } from './imageExporter.js';
import { VideoRecorder } from './videoRecorder.js';

class App {
  constructor() {
    this.mapRenderer = null;
    this.animator = null;
    this.videoRecorder = null;

    // Estado da aplicação
    this.rawPoints = [];
    this.rawVisits = [];
    this.activePoints = [];
    this.activeVisits = [];
    this.stats = null;
    this.tripTitle = 'Minhas Viagens';

    this.init();
  }

  init() {
    // 1. Inicializa o mapa Leaflet
    this.mapRenderer = new MapRenderer('map');

    // 2. Inicializa o motor de animação
    this.animator = new TimelineAnimator(this.mapRenderer);

    // 3. Inicializa o gravador de vídeo
    this.videoRecorder = new VideoRecorder(this.animator, this.mapRenderer);

    // 4. Conecta eventos de interface
    this.bindEvents();

    // 5. Configura callbacks de animação e HUD
    this.setupAnimationCallbacks();

    console.log('MyWay Timeline Visualizer inicializado com sucesso.');
  }

  bindEvents() {
    // Input de arquivo invisível
    const fileInput = document.getElementById('timeline-file-input');

    // Botão 1: Processar dados (Arquivo)
    document.getElementById('btn-process-data').addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.loadFile(file);
      }
    });

    // Botão Dados de Demonstração (Teste rápido)
    document.getElementById('btn-load-demo').addEventListener('click', () => {
      this.loadDemoData();
    });

    // Botão 2: Gerar Timeline (Visão Geral)
    document.getElementById('btn-generate-timeline').addEventListener('click', () => {
      this.generateTimelineView();
    });

    // Botão 3: Gerar Animação
    document.getElementById('btn-generate-animation').addEventListener('click', () => {
      this.startAnimationView();
    });

    // Botão 4: Gerar Imagem
    document.getElementById('btn-generate-image').addEventListener('click', () => {
      this.generateImageSnapshot();
    });

    // Botão 5: Gerar Vídeo
    document.getElementById('btn-generate-video').addEventListener('click', () => {
      this.generateVideoExport();
    });

    // Seletor de Tema do Mapa (Dark, Voyager, Satellite)
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.theme-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.theme;
        this.mapRenderer.setTheme(theme);
      });
    });

    // Controles do Player HUD
    const playPauseBtn = document.getElementById('hud-btn-play-pause');
    playPauseBtn.addEventListener('click', () => {
      if (this.animator.isPlaying) {
        this.animator.pause();
        playPauseBtn.innerHTML = '▶';
      } else {
        this.animator.play();
        playPauseBtn.innerHTML = '⏸';
      }
    });

    document.getElementById('hud-btn-reset').addEventListener('click', () => {
      this.animator.stop();
      playPauseBtn.innerHTML = '▶';
      document.getElementById('hud-scrubber').value = 0;
      this.animator.renderFrame(0);
    });

    const speedSelect = document.getElementById('hud-speed-select');
    speedSelect.addEventListener('change', (e) => {
      this.animator.setSpeed(e.target.value);
    });

    const followCameraCheckbox = document.getElementById('hud-follow-camera');
    followCameraCheckbox.addEventListener('change', (e) => {
      this.animator.setFollowCamera(e.target.checked);
    });

    const scrubber = document.getElementById('hud-scrubber');
    scrubber.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.animator.seek(val);
    });

    // Modal de Instruções de Exportação
    document.getElementById('btn-how-to-export').addEventListener('click', () => {
      document.getElementById('modal-instructions').classList.add('active');
    });

    document.getElementById('close-modal-instructions').addEventListener('click', () => {
      document.getElementById('modal-instructions').classList.remove('active');
    });

    // Cancelamento de gravação de vídeo
    document.getElementById('btn-cancel-recording').addEventListener('click', () => {
      this.videoRecorder.cancel();
      document.getElementById('modal-recording').classList.remove('active');
      this.showToast('Gravação cancelada.');
    });

    // Drag & Drop no mapa para carregar arquivo
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.loadFile(e.dataTransfer.files[0]);
      }
    });
  }

  setupAnimationCallbacks() {
    const scrubber = document.getElementById('hud-scrubber');
    const hudDate = document.getElementById('hud-date-display');
    const hudActivity = document.getElementById('hud-activity-badge');
    const playPauseBtn = document.getElementById('hud-btn-play-pause');

    this.animator.onProgressUpdate = (progress, currentPt, date) => {
      scrubber.value = progress;
      if (date) {
        hudDate.innerText = date.toLocaleString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      if (currentPt && currentPt.activity) {
        const meta = getActivityMeta(currentPt.activity);
        hudActivity.innerText = `${meta.icon} ${meta.label}`;
      }
    };

    this.animator.onAnimationEnd = () => {
      playPauseBtn.innerHTML = '▶';
      this.showToast('✨ Animação concluída!');
    };
  }

  /**
   * Processamento de arquivo JSON carregado
   */
  async loadFile(file) {
    this.showToast(`Lendo arquivo: ${file.name}...`);
    try {
      const text = await file.text();
      const result = parseGoogleTimelineJSON(text);

      this.rawPoints = result.points;
      this.rawVisits = result.visits;
      this.activePoints = result.points;
      this.activeVisits = result.visits;
      this.tripTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      this.onDataProcessed();
      this.showToast(`Sucesso! ${this.activePoints.length} pontos carregados.`);
    } catch (err) {
      alert(`Erro ao processar arquivo: ${err.message}`);
      console.error(err);
    }
  }

  /**
   * Carrega dados de demonstração
   */
  loadDemoData() {
    const demo = generateSampleTimeline();
    this.rawPoints = demo.points;
    this.rawVisits = demo.visits;
    this.activePoints = demo.points;
    this.activeVisits = demo.visits;
    this.tripTitle = demo.title;

    this.onDataProcessed();
    this.showToast('🌍 Dados de demonstração carregados com sucesso!');
    // Renderiza a timeline automaticamente
    this.generateTimelineView();
  }

  /**
   * Atualiza estatísticas e habilita botões de ação
   */
  onDataProcessed() {
    this.stats = computeTimelineStats(this.activePoints, this.activeVisits);
    this.updateStatsUI();

    // Habilita os botões que dependem de dados
    document.getElementById('btn-generate-timeline').classList.remove('disabled');
    document.getElementById('btn-generate-animation').classList.remove('disabled');
    document.getElementById('btn-generate-image').classList.remove('disabled');
    document.getElementById('btn-generate-video').classList.remove('disabled');

    // Configura os dados no motor de animação
    this.animator.setTimelineData(this.activePoints, this.activeVisits);
  }

  /**
   * Atualiza os cards de métricas na barra lateral
   */
  updateStatsUI() {
    if (!this.stats) return;

    document.getElementById('stat-distance').innerText = `${this.stats.totalDistanceKm.toLocaleString('pt-BR')} km`;
    document.getElementById('stat-duration').innerText = formatDuration(this.stats.totalDurationMs);
    document.getElementById('stat-visits').innerText = `${this.stats.totalVisits} paradas`;
    document.getElementById('stat-points').innerText = `${this.stats.totalPoints.toLocaleString('pt-BR')}`;

    const dateRangeEl = document.getElementById('stat-date-range');
    if (this.stats.dateRange.start && this.stats.dateRange.end) {
      dateRangeEl.innerText = `${this.stats.dateRange.start.toLocaleDateString('pt-BR')} - ${this.stats.dateRange.end.toLocaleDateString('pt-BR')}`;
    } else {
      dateRangeEl.innerText = 'Histórico geral';
    }

    document.getElementById('stats-panel').style.display = 'flex';
  }

  /**
   * Ação 2: Gerar Timeline (Mapa Estático com todas as rotas e paradas)
   */
  generateTimelineView() {
    if (this.activePoints.length === 0) return;
    this.animator.stop();
    document.getElementById('animation-hud').style.display = 'none';

    this.mapRenderer.renderTimeline(this.activePoints, this.activeVisits);
    this.showToast('🗺️ Timeline gerada no mapa!');
  }

  /**
   * Ação 3: Gerar Animação (Modo Player interativo)
   */
  startAnimationView() {
    if (this.activePoints.length === 0) return;

    // Limpa a linha estática para a animação dinâmica fluida
    this.mapRenderer.clearAll();
    this.mapRenderer.fitPoints(this.activePoints);

    const hud = document.getElementById('animation-hud');
    hud.style.display = 'flex';

    this.animator.seek(0);
    this.animator.play();
    document.getElementById('hud-btn-play-pause').innerHTML = '⏸';
    this.showToast('🎬 Animação iniciada!');
  }

  /**
   * Ação 4: Gerar Imagem (Snapshot em Alta Resolução)
   */
  async generateImageSnapshot() {
    if (this.activePoints.length === 0) return;
    this.showToast('📸 Gerando imagem em alta resolução...');

    // Garante que o mapa esteja enquadrado
    this.mapRenderer.renderTimeline(this.activePoints, this.activeVisits);

    // Pequena pausa para garantir renderização de tiles
    setTimeout(async () => {
      try {
        await exportTimelineImage(this.mapRenderer.getMapInstance(), this.stats, this.tripTitle);
        this.showToast('✅ Imagem salva com sucesso!');
      } catch (err) {
        console.error(err);
        alert('Falha ao exportar imagem: ' + err.message);
      }
    }, 500);
  }

  /**
   * Ação 5: Gerar Vídeo (Gravação via MediaRecorder)
   */
  async generateVideoExport() {
    if (this.activePoints.length === 0) return;

    const modalRec = document.getElementById('modal-recording');
    const recFill = document.getElementById('rec-progress-fill');
    const recText = document.getElementById('rec-progress-text');

    modalRec.classList.add('active');
    recFill.style.width = '0%';
    recText.innerText = 'Inicializando gravação a 60 FPS...';

    this.videoRecorder.onProgress = (pct, status) => {
      recFill.style.width = `${pct}%`;
      recText.innerText = `${status} (${pct}%)`;
    };

    this.videoRecorder.onComplete = (blobUrl) => {
      modalRec.classList.remove('active');
      this.showToast('🎥 Vídeo exportado e salvo com sucesso!');
    };

    try {
      await this.videoRecorder.startRecording(60);
    } catch (err) {
      modalRec.classList.remove('active');
      alert(`Falha ao gravar vídeo: ${err.message}`);
    }
  }

  /**
   * Exibe notificação temporária tipo Toast
   */
  showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
}

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.myWayApp = new App();
});
