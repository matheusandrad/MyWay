// Módulo de Gravação de Vídeo Client-Side (MediaRecorder API nativa a 60 FPS)

export class VideoRecorder {
  constructor(animator, mapRenderer) {
    this.animator = animator;
    this.mapRenderer = mapRenderer;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;

    // Callbacks
    this.onProgress = null; // (percentage, statusText) => {}
    this.onComplete = null; // (blobUrl) => {}
    this.onError = null;
  }

  /**
   * Inicia o processo de gravação do trajeto completo
   */
  async startRecording(fps = 60) {
    if (this.isRecording) return;

    // Obtém o canvas de animação
    const animCanvas = this.animator.getCanvasElement();
    if (!animCanvas) {
      throw new Error('Canvas de animação não encontrado para gravação.');
    }

    this.recordedChunks = [];
    this.isRecording = true;

    // Cria um canvas composto de gravação para garantir fundo e rota
    const mapContainer = this.mapRenderer.getMapInstance().getContainer();
    const mapSize = this.mapRenderer.getMapInstance().getSize();

    const recordCanvas = document.createElement('canvas');
    recordCanvas.width = mapSize.x;
    recordCanvas.height = mapSize.y;
    const rCtx = recordCanvas.getContext('2d');

    // Tenta obter stream do canvas a 60 FPS
    let stream;
    try {
      stream = recordCanvas.captureStream ? recordCanvas.captureStream(fps) : animCanvas.captureStream(fps);
    } catch (e) {
      throw new Error('Seu navegador não suporta captura direta de stream Canvas para vídeo.');
    }

    // Determina o formato suportado pelo navegador
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
        }
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps para excelente nitidez
      });
    } catch (err) {
      this.mediaRecorder = new MediaRecorder(stream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.isRecording = false;
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const videoUrl = URL.createObjectURL(blob);

      // Download automático do arquivo de vídeo gerado
      const a = document.createElement('a');
      a.href = videoUrl;
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      a.download = `MyWay-TravelVideo-${Date.now()}.${ext}`;
      a.click();

      if (this.onComplete) {
        this.onComplete(videoUrl);
      }
    };

    // Loop de renderização composta no canvas de gravação
    let recordingFrameId = null;
    const drawCompositeFrame = () => {
      if (!this.isRecording) return;

      // Desenha fundo escuro
      rCtx.fillStyle = '#0b0f19';
      rCtx.fillRect(0, 0, recordCanvas.width, recordCanvas.height);

      // Desenha os azulejos do mapa
      const tileImages = mapContainer.querySelectorAll('img.leaflet-tile');
      const mapRect = mapContainer.getBoundingClientRect();
      for (const img of tileImages) {
        if (img.complete && img.naturalWidth > 0) {
          const imgRect = img.getBoundingClientRect();
          const dx = (imgRect.left - mapRect.left);
          const dy = (imgRect.top - mapRect.top);
          try {
            rCtx.drawImage(img, dx, dy, imgRect.width, imgRect.height);
          } catch (e) {}
        }
      }

      // Desenha o canvas animado
      if (animCanvas) {
        try {
          rCtx.drawImage(animCanvas, 0, 0, recordCanvas.width, recordCanvas.height);
        } catch (e) {}
      }

      recordingFrameId = requestAnimationFrame(drawCompositeFrame);
    };

    // Hook no progresso do animator
    const prevProgressCallback = this.animator.onProgressUpdate;
    const prevEndCallback = this.animator.onAnimationEnd;

    this.animator.onProgressUpdate = (progress, pt, date) => {
      if (prevProgressCallback) prevProgressCallback(progress, pt, date);
      if (this.onProgress) {
        this.onProgress(Math.round(progress * 100), 'Gravando frames da animação...');
      }
    };

    this.animator.onAnimationEnd = () => {
      if (prevEndCallback) prevEndCallback();
      if (recordingFrameId) cancelAnimationFrame(recordingFrameId);

      // Pequena pausa no frame final antes de fechar o vídeo
      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
        // Restaura callbacks
        this.animator.onProgressUpdate = prevProgressCallback;
        this.animator.onAnimationEnd = prevEndCallback;
      }, 800);
    };

    // Inicia gravação e reprodução
    this.mediaRecorder.start(200); // Coleta a cada 200ms
    drawCompositeFrame();
    this.animator.seek(0);
    this.animator.play();
  }

  cancel() {
    if (this.isRecording && this.mediaRecorder) {
      this.isRecording = false;
      this.animator.pause();
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.recordedChunks = [];
    }
  }
}
