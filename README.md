# 🗺️ MyWay • Google Timeline Visualizer (Web Edition)

Uma aplicação web moderna, rápida e **100% privada** (executada totalmente no navegador do seu computador) para visualizar, animar e exportar seu Histórico de Localização do Google Timeline.

Inspirado no projeto [mahlernim/google-timeline-visualizer](https://github.com/mahlernim/google-timeline-visualizer), porém reestruturado para a Web com foco em simplicidade, interatividade instantânea e controle total pelo usuário.

Desenvolvido com auxílio do Antigravity.

---

## ✨ Funcionalidades Principais

- 📂 **1. Processar dados:**
  - Suporte completo a múltiplos formatos do Google: `Timeline.json` exportado do app Android / iOS, arquivos mensais/anuais do Google Takeout (`semanticSegments`, `placeVisit`, `activitySegment`, `Records.json`, coordenadas E7 ou graus decimais).
  - Filtro inteligente de ruídos e outliers de GPS (teleportes improváveis).
  - **✨ Dados de Demonstração integrados:** Teste instantaneamente com uma Eurotrip fictícia completa com 1 clique!
- 🗺️ **2. Gerar timeline:**
  - Desenha todo o seu histórico percorrido em um mapa moderno com tema escuro (Dark Matter), trajetos neon e marcadores nos pontos e cidades visitadas.
  - Painel de métricas com distância total em km, tempo em viagem, total de locais visitados e pontos GPS.
- 🎬 **3. Gerar animação:**
  - Player temporal fluido a **60 FPS** via Canvas 2D com interpolação de curvas e arcos de voo geodésicos (*Great-Circle*).
  - Controles: Play, Pause, Reiniciar, controle de velocidade (2x até 50x), câmera seguidora suave e scrubber temporal arrastável.
- 📸 **4. Gerar imagem:**
  - Captura instantânea em alta resolução (PNG) com card estilizado (*Travel Recap / Spotify Wrapped*), incluindo mapa real ao fundo, rotas e resumo estatístico.
- 🎥 **5. Gerar vídeo:**
  - Gravação automática da animação em vídeo (.webm / .mp4) a 60 FPS direto no navegador via `MediaRecorder`, com indicador de progresso em tempo real.

---

## 🚀 Como Executar (Zero Instalação, Sem Servidor)

Basta **dar um duplo clique** no arquivo [`MyWay.html`](file:///d:/Desenvolvimento/MyWay/MyWay.html) em qualquer navegador moderno (Chrome, Edge, Firefox, Brave, Safari, Opera).

Ou, se preferir no Windows, dê um duplo clique em [`iniciar.bat`](file:///d:/Desenvolvimento/MyWay/iniciar.bat).

---

## 🔒 Privacidade e Segurança
Todos os seus dados de localização são processados **única e exclusivamente na memória RAM do seu navegador**. Nenhum arquivo, coordenada ou histórico é enviado para servidores externos ou armazenado na nuvem.
