/* Memora — Editor de Vídeo de Recordações
   Prévia com transições animadas, reprodução sincronizada e timeline com progresso.
*/
"use strict";

const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
// Use somente a chave publicável do projeto. Nunca use service_role ou segredo.
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const params = new URLSearchParams(window.location.search);
const EVENTO = params.get("evento") || "";
const EVENTO_ID = params.get("eventoId") || "";
const $ = (id) => document.getElementById(id);

const statusVideo = $("statusVideo");
const telaVideo = $("telaVideo");
const fotoVideo = $("fotoVideo");
const textoSobreposto = $("textoSobreposto");
const linhaTempo = $("linhaTempo");
const timelineRuler = $("timelineRuler");
const timelinePlayhead = $("timelinePlayhead");
const timelineScroll = $("timelineScroll");
const PIXELS_POR_SEGUNDO = 24;

const botaoIniciar = $("iniciar");
const botaoPausar = $("pausar");
const botaoAnterior = $("anterior");
const botaoProxima = $("proxima");

const duracaoCena = $("duracaoCena");
const duracaoNumero = $("duracaoNumero");
const duracaoValor = $("duracaoValor");
const duracaoResumo = $("duracaoResumo");
const transicaoResumo = $("transicaoResumo");

const musicaArquivo = $("musicaArquivo");
const audioMusica = $("audioMusica");
const fundoImagem = $("fundoImagem");

let slides = [];
let indiceAtual = 0;
let timerCena = null;
let rafReproducao = null;
let reproduzindo = false;
let inicioSegmento = 0;
let tempoDecorridoMs = 0;
let musicaUrl = null;
let fundoImagemUrl = null;
let arrastandoIndice = null;
let eventoNome = "";
let animacaoAtual = null;
let tokenTransicao = 0;

const DURACAO_TRANSICAO_MS = 650;

const CONFIG_PADRAO = {
  texto: "",
  fonte: "Georgia,serif",
  tamanho: 30,
  cor: "#ffffff",
  posicaoTexto: "bottom",
  fit: "contain",
  x: 0,
  y: 0,
  zoom: 100,
  duracao: 7,
  alinhamento: "center",
  transicao: "fade",
};

const NOMES_TRANSICAO = {
  fade: "Dissolver",
  slide: "Deslizar",
  zoom: "Zoom suave",
  none: "Corte direto",
};

/* Cria uma segunda camada para animar a próxima foto sem piscar a imagem atual. */
const fotoProxima = document.createElement("img");
fotoProxima.className = "screen-photo screen-photo-next";
fotoProxima.alt = "";
fotoProxima.hidden = true;
fotoProxima.setAttribute("aria-hidden", "true");
fotoProxima.style.zIndex = "1";
fotoVideo.style.zIndex = "0";
fotoVideo.style.willChange = "opacity, transform";
fotoProxima.style.willChange = "opacity, transform";
telaVideo.insertBefore(fotoProxima, textoSobreposto);

/* O CSS de transição fica aqui para não depender de classes antigas conflitantes. */
const estiloTransicoes = document.createElement("style");
estiloTransicoes.textContent = `
  .screen-photo {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    will-change: opacity, transform, translate, scale;
    backface-visibility: hidden;
    user-select: none;
    -webkit-user-drag: none;
}

#telaVideo {
    position: relative;
    overflow: hidden;
    touch-action: none;
}
  .screen-photo-next { pointer-events: none; }
  .clip { overflow: hidden; }
  .clip-progress {
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 3px;
    height: 3px;
    overflow: hidden;
    border-radius: 99px;
    background: #ffffff2b;
    pointer-events: none;
  }
  .clip-progress-fill {
    width: 0%;
    height: 100%;
    background: var(--gold, #c6a15b);
    transform-origin: left center;
  }
  .clip.playing .clip-progress {
    height: 4px;
    background: #ffffff50;
  }
  .clip.playing .clip-progress-fill { box-shadow: 0 0 7px #c6a15b99; }
  .clip.selected { scroll-margin-inline: 10px; }
  .player-controls .btn[aria-pressed="true"] { box-shadow: 0 0 0 2px #c6a15b55; }
`;
document.head.appendChild(estiloTransicoes);

function mostrarStatus(texto, erro = false) {
  if (!statusVideo) return;
  statusVideo.textContent = texto;
  statusVideo.classList.toggle("error", erro);
}

function configAtual() {
  return slides[indiceAtual];
}

function tempoCenaAtualMs() {
  return Math.max(2000, Number(configAtual()?.duracao || 7) * 1000);
}

function formatarTempo(ms) {
  const segundos = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

function atualizarResumoDuracao(slide) {
  if (!slide) return;
  duracaoCena.value = String(slide.duracao);
  if (duracaoNumero) duracaoNumero.value = String(slide.duracao);
  duracaoValor.textContent = `${slide.duracao} segundos`;
  duracaoResumo.textContent = `${slide.duracao} s`;
}

function atualizarResumoTransicao(slide) {
  if (!slide) return;
  const tipo = slide.transicao || "fade";
  $("transicaoCena").value = tipo;
  transicaoResumo.textContent = NOMES_TRANSICAO[tipo] || "Dissolver";
}

function aplicarEstiloDaFoto(elemento, slide) {
  const zoom = Math.max(50, Math.min(400, Number(slide.zoom) || 100));

  elemento.style.position = "absolute";
  elemento.style.inset = "0";
  elemento.style.width = "100%";
  elemento.style.height = "100%";

  // Respeita o modo escolhido no menu Enquadramento.
  elemento.style.objectFit = slide.fit === "contain" ? "contain" : "cover";

  elemento.style.objectPosition = "center center";
  elemento.style.transformOrigin = "center center";
  elemento.style.translate = `${Number(slide.x) || 0}px ${Number(slide.y) || 0}px`;
  elemento.style.scale = String(zoom / 100);
}

let arrasteFotoAtivo = false;
let inicioArrasteX = 0;
let inicioArrasteY = 0;
let posicaoInicialX = 0;
let posicaoInicialY = 0;

telaVideo.style.touchAction = "none";
fotoVideo.style.cursor = "grab";

telaVideo.addEventListener("pointerdown", (evento) => {
  const slide = configAtual();

  if (!slide?.url || evento.target === textoSobreposto) return;

  arrasteFotoAtivo = true;
  inicioArrasteX = evento.clientX;
  inicioArrasteY = evento.clientY;
  posicaoInicialX = Number(slide.x) || 0;
  posicaoInicialY = Number(slide.y) || 0;

  telaVideo.setPointerCapture(evento.pointerId);
  fotoVideo.style.cursor = "grabbing";
  evento.preventDefault();
});

telaVideo.addEventListener("pointermove", (evento) => {
  if (!arrasteFotoAtivo) return;

  const slide = configAtual();
  if (!slide) return;

  slide.x = posicaoInicialX + (evento.clientX - inicioArrasteX);
  slide.y = posicaoInicialY + (evento.clientY - inicioArrasteY);

  aplicarEstiloDaFoto(fotoVideo, slide);
  aplicarEstiloDaFoto(fotoProxima, slide);
  salvarRascunhoLocal();

  evento.preventDefault();
});

function finalizarArrasteFoto() {
  if (!arrasteFotoAtivo) return;

  arrasteFotoAtivo = false;
  fotoVideo.style.cursor = "grab";

  const slide = configAtual();
  if (slide) salvarRascunhoLocal();
}

telaVideo.addEventListener("pointerup", finalizarArrasteFoto);
telaVideo.addEventListener("pointercancel", finalizarArrasteFoto);

function atualizarTextoDaCena(slide) {
  textoSobreposto.textContent = slide.texto || "";
  textoSobreposto.style.fontFamily = slide.fonte || "Georgia,serif";
  textoSobreposto.style.fontSize = `clamp(14px, ${Math.max(1.2, (Number(slide.tamanho) || 30) / 12)}vw, ${Number(slide.tamanho) || 30}px)`;
  textoSobreposto.style.color = slide.cor || "#ffffff";
  textoSobreposto.classList.remove("align-left", "align-center", "align-right");
  textoSobreposto.classList.add(`align-${slide.alinhamento || "center"}`);
  textoSobreposto.style.top =
    slide.posicaoTexto === "top"
      ? "7%"
      : slide.posicaoTexto === "center"
        ? "50%"
        : "auto";
  textoSobreposto.style.bottom =
    slide.posicaoTexto === "bottom" ? "7%" : "auto";
  textoSobreposto.style.transform =
    slide.posicaoTexto === "center" ? "translateY(-50%)" : "none";
}

function atualizarFundo() {
  const campoFundo = $("fundoCor");
  telaVideo.style.backgroundColor = campoFundo?.value || "#171717";
  telaVideo.style.backgroundImage = fundoImagemUrl
    ? `url("${fundoImagemUrl}")`
    : "none";
  telaVideo.style.backgroundSize = "cover";
  telaVideo.style.backgroundPosition = "center";
}

function atualizarTela(opcoes = {}) {
  const slide = configAtual();
  if (!slide) return;

  if (!opcoes.manterImagem) {
    fotoVideo.src = slide.url;
    fotoVideo.hidden = false;
    fotoVideo.style.opacity = "1";
    fotoVideo.style.transform = "none";
    fotoProxima.hidden = true;
    fotoProxima.removeAttribute("src");
    fotoProxima.style.opacity = "0";
    fotoProxima.style.transform = "none";
  }

  aplicarEstiloDaFoto(fotoVideo, slide);
  aplicarEstiloDaFoto(fotoProxima, slide);
  atualizarTextoDaCena(slide);
  atualizarFundo();

  $("numeroCena").textContent = `Cena ${indiceAtual + 1}`;
  atualizarResumoDuracao(slide);
  atualizarResumoTransicao(slide);
  atualizarStatusReproducao();
  renderizarLinhaTempo();
  atualizarBotoes();
  salvarRascunhoLocal();
}

function preencherControlesCena() {
  const slide = configAtual();
  if (!slide) return;

  $("textoCena").value = slide.texto || "";
  $("fonteTexto").value = slide.fonte || "Georgia,serif";
  $("tamanhoTexto").value = slide.tamanho || 30;
  $("corTexto").value = slide.cor || "#ffffff";
  $("posicaoTexto").value = slide.posicaoTexto || "bottom";
  $("alinhamentoTexto").value = slide.alinhamento || "center";
  $("ajusteImagem").value = slide.fit || "contain";
  $("zoomImagem").value = slide.zoom ?? 100;
  atualizarResumoDuracao(slide);
  atualizarResumoTransicao(slide);
}

function limparAnimacaoAtual() {
  tokenTransicao++;
  if (animacaoAtual) {
    animacaoAtual.forEach((animacao) => {
      try {
        animacao.cancel();
      } catch (_) {}
    });
    animacaoAtual = null;
  }
  fotoVideo.style.opacity = "1";
  fotoVideo.style.transform = "none";
  fotoProxima.style.opacity = "0";
  fotoProxima.style.transform = "none";
  fotoProxima.hidden = true;
}

function animarTransicao(slideAnterior, slideNovo) {
  const tipo = slideNovo?.transicao || "fade";

  if (!slideNovo?.url || tipo === "none" || !slideAnterior?.url) {
    limparAnimacaoAtual();
    fotoVideo.src = slideNovo.url;
    fotoVideo.hidden = false;
    aplicarEstiloDaFoto(fotoVideo, slideNovo);
    return Promise.resolve();
  }

  limparAnimacaoAtual();
  const token = tokenTransicao;
  fotoProxima.hidden = false;
  fotoProxima.src = slideNovo.url;
  aplicarEstiloDaFoto(fotoProxima, slideNovo);
  fotoProxima.style.zIndex = "1";
  fotoVideo.style.zIndex = "0";

  const iniciarAnimacao = () => {
    if (token !== tokenTransicao) return Promise.resolve();
    let quadrosAntiga;
    let quadrosNova;

    if (tipo === "slide") {
      quadrosAntiga = [
        { opacity: 1, transform: "translateX(0)" },
        { opacity: 0.35, transform: "translateX(-12%)" },
      ];
      quadrosNova = [
        { opacity: 1, transform: "translateX(100%)" },
        { opacity: 1, transform: "translateX(0)" },
      ];
    } else if (tipo === "zoom") {
      quadrosAntiga = [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(.97)" },
      ];
      quadrosNova = [
        { opacity: 0, transform: "scale(1.10)" },
        { opacity: 1, transform: "scale(1)" },
      ];
    } else {
      quadrosAntiga = [{ opacity: 1 }, { opacity: 0 }];
      quadrosNova = [{ opacity: 0 }, { opacity: 1 }];
    }

    const opcoes = {
      duration: DURACAO_TRANSICAO_MS,
      easing: tipo === "slide" ? "cubic-bezier(.22,.7,.25,1)" : "ease-in-out",
      fill: "forwards",
    };

    const antiga = fotoVideo.animate(quadrosAntiga, opcoes);
    const nova = fotoProxima.animate(quadrosNova, opcoes);
    animacaoAtual = [antiga, nova];

    return Promise.allSettled([antiga.finished, nova.finished]).then(() => {
      if (token !== tokenTransicao) return;
      antiga.cancel();
      nova.cancel();
      animacaoAtual = null;
      fotoVideo.src = slideNovo.url;
      fotoVideo.hidden = false;
      aplicarEstiloDaFoto(fotoVideo, slideNovo);
      fotoVideo.style.opacity = "1";
      fotoVideo.style.transform = "none";
      fotoProxima.hidden = true;
      fotoProxima.removeAttribute("src");
      fotoProxima.style.opacity = "0";
      fotoProxima.style.transform = "none";
    });
  };

  return new Promise((resolve) => {
    const concluirPreparacao = () => {
      if (token !== tokenTransicao) return resolve();
      iniciarAnimacao().then(resolve);
    };
    if (fotoProxima.complete && fotoProxima.naturalWidth > 0) {
      requestAnimationFrame(concluirPreparacao);
    } else {
      fotoProxima.onload = () => requestAnimationFrame(concluirPreparacao);
      fotoProxima.onerror = () => {
        if (token === tokenTransicao) {
          fotoVideo.src = slideNovo.url;
          fotoProxima.hidden = true;
        }
        resolve();
      };
    }
  });
}

function selecionarCena(indice, opcoes = {}) {
  if (!slides.length) return;
  const indiceNovo = Math.max(0, Math.min(indice, slides.length - 1));
  if (indiceNovo === indiceAtual && !opcoes.forcarTransicao) {
    atualizarBotoes();
    return;
  }

  if (opcoes.parar !== false) pausarPrevia();
  const anterior = configAtual();
  indiceAtual = indiceNovo;
  const novo = configAtual();

  preencherControlesCena();
  atualizarTextoDaCena(novo);
  atualizarFundo();
  $("numeroCena").textContent = `Cena ${indiceAtual + 1}`;
  atualizarResumoDuracao(novo);
  atualizarResumoTransicao(novo);

  if (opcoes.animar !== false) {
    animarTransicao(anterior, novo);
  } else {
    limparAnimacaoAtual();
    fotoVideo.src = novo.url;
    fotoVideo.hidden = false;
    aplicarEstiloDaFoto(fotoVideo, novo);
  }

  atualizarStatusReproducao();
  renderizarLinhaTempo();
  atualizarBotoes();
  salvarRascunhoLocal();

  const item = linhaTempo.querySelector(`[data-index="${indiceAtual}"]`);
  item?.scrollIntoView({
    behavior: opcoes.suave === false ? "auto" : "smooth",
    block: "nearest",
    inline: "nearest",
  });
}

function renderizarLinhaTempo() {
  if (!linhaTempo) return;
  const scrollLeft = linhaTempo.scrollLeft;
  linhaTempo.replaceChildren();
  if (timelinePlayhead) linhaTempo.appendChild(timelinePlayhead);

  slides.forEach((slide, indice) => {
    const clip = document.createElement("button");
    clip.type = "button";
    clip.className = `clip${indice === indiceAtual ? " selected" : ""}${reproduzindo && indice === indiceAtual ? " playing" : ""}`;
    clip.dataset.index = String(indice);
    clip.style.flexBasis = `${Math.max(58, Number(slide.duracao || 7) * PIXELS_POR_SEGUNDO - 3)}px`;
    clip.style.width = clip.style.flexBasis;
    clip.draggable = true;
    clip.setAttribute("aria-label", `Editar cena ${indice + 1}`);

    const img = document.createElement("img");
    img.src = slide.url;
    img.alt = "";
    img.loading = "lazy";

    const grip = document.createElement("span");
    grip.className = "clip-grip";
    grip.textContent = "⋮⋮";

    const meta = document.createElement("div");
    meta.className = "clip-meta";
    const numero = document.createElement("span");
    numero.textContent = `Cena ${indice + 1}`;
    const duracao = document.createElement("span");
    duracao.textContent = `${slide.duracao}s`;
    meta.append(numero, duracao);

    const nome = document.createElement("span");
    nome.className = "clip-name";
    nome.textContent = slide.texto || slide.name;

    clip.append(img, grip, meta, nome);
    clip.addEventListener("click", () =>
      selecionarCena(Number(clip.dataset.index)),
    );

    clip.addEventListener("dragstart", (event) => {
      arrastandoIndice = Number(clip.dataset.index);
      clip.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(arrastandoIndice));
    });

    clip.addEventListener("dragend", () => {
      arrastandoIndice = null;
      linhaTempo
        .querySelectorAll(".clip")
        .forEach((el) => el.classList.remove("dragging"));
    });

    clip.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    clip.addEventListener("drop", (event) => {
      event.preventDefault();
      const origem =
        arrastandoIndice ?? Number(event.dataTransfer.getData("text/plain"));
      const destino = Number(clip.dataset.index);
      if (
        !Number.isInteger(origem) ||
        !Number.isInteger(destino) ||
        origem === destino ||
        origem < 0 ||
        destino < 0 ||
        origem >= slides.length ||
        destino >= slides.length
      )
        return;

      const [movido] = slides.splice(origem, 1);
      slides.splice(destino, 0, movido);

      if (indiceAtual === origem) indiceAtual = destino;
      else if (origem < indiceAtual && destino >= indiceAtual) indiceAtual--;
      else if (origem > indiceAtual && destino <= indiceAtual) indiceAtual++;

      tempoDecorridoMs = 0;
      preencherControlesCena();
      atualizarTela();
      if (reproduzindo) reiniciarRelogioDaCena();
    });

    linhaTempo.appendChild(clip);
  });

  $("totalCenas").textContent = `${slides.length} cenas`;
  linhaTempo.scrollLeft = scrollLeft;
  renderizarReguaTimeline();
  atualizarProgressoTimeline();
}

function duracaoTotalTimelineMs() {
  return slides.reduce(
    (soma, slide) => soma + Math.max(2000, Number(slide.duracao || 7) * 1000),
    0,
  );
}

function tempoAbsolutoAtualMs() {
  const anteriores = slides
    .slice(0, indiceAtual)
    .reduce(
      (soma, slide) => soma + Math.max(2000, Number(slide.duracao || 7) * 1000),
      0,
    );
  const atual = reproduzindo
    ? tempoDecorridoMs + Math.max(0, performance.now() - inicioSegmento)
    : tempoDecorridoMs;
  return anteriores + Math.min(tempoCenaAtualMs(), Math.max(0, atual));
}

function renderizarReguaTimeline() {
  if (!timelineRuler) return;
  const totalMs = duracaoTotalTimelineMs();
  const totalSegundos = Math.max(1, Math.ceil(totalMs / 1000));
  const largura = totalSegundos * PIXELS_POR_SEGUNDO;
  timelineRuler.style.width = `${largura}px`;
  timelineRuler.replaceChildren();
  const passo =
    totalSegundos > 600
      ? 60
      : totalSegundos > 180
        ? 30
        : totalSegundos > 60
          ? 10
          : 5;
  for (let segundo = 0; segundo <= totalSegundos; segundo += passo) {
    const tick = document.createElement("span");
    tick.className = "timeline-tick";
    tick.style.left = `${segundo * PIXELS_POR_SEGUNDO}px`;
    tick.textContent = `${Math.floor(segundo / 60)}:${String(segundo % 60).padStart(2, "0")}`;
    timelineRuler.appendChild(tick);
  }
  linhaTempo.style.width = `${largura}px`;
}

timelineRuler.addEventListener("click", (event) => {
  const retangulo = timelineRuler.getBoundingClientRect();

  const x = event.clientX - retangulo.left;
  const tempoMs = (x / PIXELS_POR_SEGUNDO) * 1000;

  navegarParaTempo(tempoMs);
});

function atualizarProgressoTimeline() {
  if (!slides.length || !timelinePlayhead) return;
  const tempoMs = tempoAbsolutoAtualMs();
  const x = (tempoMs / 1000) * PIXELS_POR_SEGUNDO + 3;
  timelinePlayhead.style.left = `${x}px`;
  linhaTempo.querySelectorAll(".clip").forEach((el, indice) => {
    el.classList.toggle("playing", reproduzindo && indice === indiceAtual);
  });
}

if (timelineRuler && timelineScroll) {
  timelineRuler.addEventListener("click", (event) => {
    const retangulo = timelineRuler.getBoundingClientRect();

    const x = event.clientX - retangulo.left + timelineScroll.scrollLeft;

    const tempoMs = (x / PIXELS_POR_SEGUNDO) * 1000;

    navegarParaTempo(tempoMs);
  });
}

function navegarParaTempo(tempoMs) {
  if (!slides.length) return;

  pausarPrevia();

  const totalMs = duracaoTotalTimelineMs();
  const tempoAlvo = Math.max(0, Math.min(tempoMs, totalMs - 1));

  let acumulado = 0;
  let indice = 0;

  for (let i = 0; i < slides.length; i++) {
    const duracao = Math.max(2000, Number(slides[i].duracao || 7) * 1000);

    if (tempoAlvo < acumulado + duracao) {
      indice = i;
      tempoDecorridoMs = tempoAlvo - acumulado;
      break;
    }

    acumulado += duracao;
  }

  selecionarCena(indice, { parar: false });

  atualizarProgressoTimeline();
  atualizarStatusReproducao();
}

function atualizarStatusReproducao() {
  const slide = configAtual();
  if (!slide) return;
  const total = Math.max(2000, Number(slide.duracao || 7) * 1000);
  const decorrido = reproduzindo
    ? tempoDecorridoMs + Math.max(0, performance.now() - inicioSegmento)
    : tempoDecorridoMs;
  const restante = Math.max(0, total - decorrido);
  mostrarStatus(
    `Cena ${indiceAtual + 1} de ${slides.length} · ${slide.duracao}s` +
      (reproduzindo ? ` · ${formatarTempo(restante)} restantes` : ""),
  );
}

function atualizarBotoes() {
  const temSlides = slides.length > 0;
  botaoIniciar.disabled = !temSlides || reproduzindo;
  botaoPausar.disabled = !temSlides || !reproduzindo;
  botaoAnterior.disabled = !temSlides;
  botaoProxima.disabled = !temSlides;
  botaoIniciar.setAttribute("aria-pressed", String(reproduzindo));
  botaoPausar.setAttribute("aria-pressed", String(!reproduzindo));
}

function cancelarRelogios() {
  if (timerCena !== null) {
    clearTimeout(timerCena);
    timerCena = null;
  }
  if (rafReproducao !== null) {
    cancelAnimationFrame(rafReproducao);
    rafReproducao = null;
  }
}

function pausarPrevia() {
  if (reproduzindo) {
    tempoDecorridoMs += Math.max(0, performance.now() - inicioSegmento);
  }
  reproduzindo = false;
  cancelarRelogios();
  audioMusica.pause();
  atualizarProgressoTimeline();
  atualizarStatusReproducao();
  renderizarLinhaTempo();
  atualizarBotoes();
}

function tickReproducao() {
  if (!reproduzindo) return;

  const total = tempoCenaAtualMs();
  const decorrido =
    tempoDecorridoMs + Math.max(0, performance.now() - inicioSegmento);

  atualizarProgressoTimeline();
  atualizarStatusReproducao();

  if (decorrido >= total) {
    avançarAutomaticamente();
    return;
  }
  rafReproducao = requestAnimationFrame(tickReproducao);
}

function agendarFimDaCena() {
  if (!reproduzindo) return;
  if (timerCena !== null) clearTimeout(timerCena);
  const restante = Math.max(0, tempoCenaAtualMs() - tempoDecorridoMs);
  timerCena = setTimeout(avançarAutomaticamente, restante);
  if (rafReproducao !== null) cancelAnimationFrame(rafReproducao);
  rafReproducao = requestAnimationFrame(tickReproducao);
}

async function avançarAutomaticamente() {
  if (!reproduzindo || !slides.length) return;
  cancelarRelogios();
  const anterior = configAtual();
  indiceAtual = (indiceAtual + 1) % slides.length;
  tempoDecorridoMs = 0;
  inicioSegmento = performance.now();

  const novo = configAtual();
  preencherControlesCena();
  atualizarTextoDaCena(novo);
  atualizarFundo();
  $("numeroCena").textContent = `Cena ${indiceAtual + 1}`;
  atualizarResumoDuracao(novo);
  atualizarResumoTransicao(novo);
  renderizarLinhaTempo();
  atualizarBotoes();
  salvarRascunhoLocal();

  const item = linhaTempo.querySelector(`[data-index="${indiceAtual}"]`);
  item?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "nearest",
  });

  await animarTransicao(anterior, novo);
  if (reproduzindo) agendarFimDaCena();
}

async function reiniciarRelogioDaCena() {
  if (!reproduzindo) return;
  tempoDecorridoMs = 0;
  inicioSegmento = performance.now();
  agendarFimDaCena();
}

async function iniciarPrevia() {
  if (!slides.length || reproduzindo) return;
  reproduzindo = true;
  inicioSegmento = performance.now();
  atualizarBotoes();
  renderizarLinhaTempo();

  if (musicaUrl) {
    try {
      await audioMusica.play();
    } catch (error) {
      console.warn("O navegador não iniciou o áudio automaticamente.", error);
    }
  }

  agendarFimDaCena();
}

function atualizarConfiguracao(chave, valor) {
  const slide = configAtual();
  if (!slide) return;
  slide[chave] = valor;

  if (chave === "fit" || chave === "x" || chave === "y" || chave === "zoom") {
    aplicarEstiloDaFoto(fotoVideo, slide);
    aplicarEstiloDaFoto(fotoProxima, slide);
  }
  if (
    chave === "texto" ||
    chave === "fonte" ||
    chave === "tamanho" ||
    chave === "cor" ||
    chave === "posicaoTexto" ||
    chave === "alinhamento"
  ) {
    atualizarTextoDaCena(slide);
  }

  atualizarResumoDuracao(slide);
  atualizarResumoTransicao(slide);
  atualizarProgressoTimeline();
  renderizarLinhaTempo();
  atualizarStatusReproducao();
  salvarRascunhoLocal();
}

function serializarSlides() {
  return slides.map(
    ({
      name,
      texto,
      fonte,
      tamanho,
      cor,
      posicaoTexto,
      alinhamento,
      transicao,
      fit,
      x,
      y,
      zoom,
      duracao,
    }) => ({
      name,
      texto,
      fonte,
      tamanho,
      cor,
      posicaoTexto,
      alinhamento,
      transicao,
      fit,
      x,
      y,
      zoom,
      duracao,
    }),
  );
}

function salvarRascunhoLocal() {
  if (!EVENTO_ID) return;
  try {
    localStorage.setItem(
      `memora-video-rascunho-${EVENTO_ID}`,
      JSON.stringify({
        slides: serializarSlides(),
        fundoCor: $("fundoCor").value,
        salvoEm: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("Não foi possível salvar o rascunho local.", error);
  }
}

function restaurarRascunhoLocal() {
  if (!EVENTO_ID) return;
  try {
    const salvo = localStorage.getItem(`memora-video-rascunho-${EVENTO_ID}`);
    if (!salvo) return;
    const dados = JSON.parse(salvo);
    if (dados.fundoCor) $("fundoCor").value = dados.fundoCor;
    const mapa = new Map(
      (dados.slides || []).map((slide) => [slide.name, slide]),
    );
    slides = slides.map((slide) => {
      const salvoDaCena = mapa.get(slide.name);
      return salvoDaCena ? { ...slide, ...salvoDaCena, url: slide.url } : slide;
    });
  } catch (error) {
    console.warn("Não foi possível restaurar o rascunho.", error);
  }
}

async function carregarEventoEFotos() {
  mostrarStatus("Verificando sua conta e o evento...");

  try {
    const { data: sessaoData, error: erroSessao } =
      await supabaseClient.auth.getSession();
    if (erroSessao || !sessaoData?.session) {
      window.location.replace("conta.html");
      return;
    }

    if (!EVENTO_ID || !EVENTO) {
      mostrarStatus(
        "Abra o editor pelo Dashboard para selecionar um evento.",
        true,
      );
      return;
    }

    const usuario = sessaoData.session.user;
    const { data: evento, error: erroEvento } = await supabaseClient
      .from("eventos")
      .select("id, nome, slug, storage_folder, owner_id")
      .eq("id", EVENTO_ID)
      .eq("owner_id", usuario.id)
      .maybeSingle();

    if (erroEvento) {
      console.error("Erro ao consultar o evento:", erroEvento);
      mostrarStatus(
        "Não foi possível validar este evento. Confira a conexão e as permissões.",
        true,
      );
      return;
    }

    if (!evento || (evento.storage_folder || evento.slug) !== EVENTO) {
      mostrarStatus("Este evento não está disponível para esta conta.", true);
      return;
    }

    eventoNome = evento.nome;
    document.title = `Vídeo de Recordações — ${evento.nome} | Memora`;
    mostrarStatus("Carregando fotografias...");

    const { data, error } = await supabaseClient.storage
      .from("fotos-eventos")
      .list(EVENTO, {
        limit: 500,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.error("Erro ao listar fotos:", error);
      mostrarStatus(
        "Não foi possível carregar as fotografias deste evento.",
        true,
      );
      return;
    }

    const arquivos = (data || []).filter(
      (item) =>
        item.name &&
        item.name !== ".emptyFolderPlaceholder" &&
        /\.(jpe?g|png|webp|gif|avif)$/i.test(item.name),
    );

    slides = arquivos.map((item) => {
      const { data: urlData } = supabaseClient.storage
        .from("fotos-eventos")
        .getPublicUrl(`${EVENTO}/${item.name}`);
      return { name: item.name, url: urlData.publicUrl, ...CONFIG_PADRAO };
    });

    if (!slides.length) {
      mostrarStatus("Não foram encontradas fotografias neste evento.", true);
      atualizarBotoes();
      return;
    }

    restaurarRascunhoLocal();
    preencherControlesCena();
    atualizarTela();
    atualizarBotoes();
  } catch (error) {
    console.error("Erro inesperado ao carregar o editor:", error);
    mostrarStatus(
      "Ocorreu um erro ao carregar o editor. Confira o Console para ver os detalhes.",
      true,
    );
  }
}

/* Texto e imagem da cena */
$("textoCena").addEventListener("input", (event) =>
  atualizarConfiguracao("texto", event.target.value),
);
$("fonteTexto").addEventListener("change", (event) =>
  atualizarConfiguracao("fonte", event.target.value),
);
$("tamanhoTexto").addEventListener("input", (event) =>
  atualizarConfiguracao(
    "tamanho",
    Math.max(12, Math.min(54, Number(event.target.value) || 30)),
  ),
);
$("corTexto").addEventListener("input", (event) =>
  atualizarConfiguracao("cor", event.target.value),
);
$("posicaoTexto").addEventListener("change", (event) =>
  atualizarConfiguracao("posicaoTexto", event.target.value),
);
$("alinhamentoTexto").addEventListener("change", (event) =>
  atualizarConfiguracao("alinhamento", event.target.value),
);
$("ajusteImagem").addEventListener("change", (event) =>
  atualizarConfiguracao("fit", event.target.value),
);

$("zoomImagem").addEventListener("input", (event) => {
  const valor = Number(event.target.value);
  if (!Number.isFinite(valor)) return;

  const zoom = Math.max(50, Math.min(400, valor));
  atualizarConfiguracao("zoom", zoom);
});

$("zoomImagem").addEventListener("change", (event) => {
  const zoom = Math.max(50, Math.min(400, Number(event.target.value) || 100));

  event.target.value = zoom;
  atualizarConfiguracao("zoom", zoom);
});

let tipoTransicaoPendente = null;
let tipoTransicaoAnterior = null;

const modalTransicao = $("modalTransicao");
const textoModalTransicao = $("textoModalTransicao");

function fecharModalTransicao() {
  modalTransicao.hidden = true;
  tipoTransicaoPendente = null;
  tipoTransicaoAnterior = null;
}

function aplicarTransicao(tipo, aplicarEmTodas) {
  const nome = NOMES_TRANSICAO[tipo] || tipo;

  if (aplicarEmTodas) {
    slides.forEach((slide) => {
      slide.transicao = tipo;
    });

    preencherControlesCena();
    atualizarTela({ manterImagem: true });

    mostrarStatus(
      `Transição “${nome}” aplicada a todas as ${slides.length} cenas.`,
    );
  } else {
    configAtual().transicao = tipo;

    preencherControlesCena();
    atualizarTela({ manterImagem: true });

    mostrarStatus(
      `Transição “${nome}” aplicada somente à cena ${indiceAtual + 1}.`,
    );
  }

  if (tipoTransicaoAnterior !== tipo && reproduzindo) {
    salvarRascunhoLocal();
  }

  fecharModalTransicao();
}

$("transicaoCena").addEventListener("change", (event) => {
  const tipo = event.target.value;
  const nome = NOMES_TRANSICAO[tipo] || tipo;

  tipoTransicaoPendente = tipo;
  tipoTransicaoAnterior = configAtual()?.transicao || "fade";

  textoModalTransicao.textContent = `Você escolheu “${nome}”. Como deseja aplicar esse efeito?`;

  modalTransicao.hidden = false;
});

$("aplicarTransicaoTodas").addEventListener("click", () => {
  if (tipoTransicaoPendente === null) return;

  aplicarTransicao(tipoTransicaoPendente, true);
});

$("aplicarTransicaoAtual").addEventListener("click", () => {
  if (tipoTransicaoPendente === null) return;

  aplicarTransicao(tipoTransicaoPendente, false);
});

$("cancelarModalTransicao").addEventListener("click", () => {
  if (tipoTransicaoAnterior !== null) {
    $("transicaoCena").value = tipoTransicaoAnterior;
  }

  fecharModalTransicao();
});

function atualizarDuracaoSelecionada(valorBruto) {
  const slide = configAtual();
  if (!slide || valorBruto === "") return;
  const numero = Number(valorBruto);
  if (!Number.isFinite(numero)) return;

  const valor = Math.max(2, Math.min(20, Math.round(numero)));
  const duracaoAnterior = Number(slide.duracao || 7) * 1000;
  slide.duracao = valor;
  atualizarResumoDuracao(slide);
  renderizarLinhaTempo();
  atualizarStatusReproducao();
  salvarRascunhoLocal();

  if (reproduzindo) {
    const decorrido =
      tempoDecorridoMs + Math.max(0, performance.now() - inicioSegmento);
    tempoDecorridoMs = Math.min(decorrido, valor * 1000);
    inicioSegmento = performance.now();
    if (tempoDecorridoMs >= valor * 1000) {
      avançarAutomaticamente();
    } else {
      agendarFimDaCena();
    }
  } else if (duracaoAnterior !== valor * 1000) {
    atualizarProgressoTimeline();
  }
}

duracaoCena.addEventListener("input", (event) =>
  atualizarDuracaoSelecionada(event.target.value),
);
duracaoCena.addEventListener("change", (event) =>
  atualizarDuracaoSelecionada(event.target.value),
);
if (duracaoNumero) {
  duracaoNumero.addEventListener("input", (event) => {
    if (event.target.value !== "")
      atualizarDuracaoSelecionada(event.target.value);
  });
  duracaoNumero.addEventListener("change", (event) => {
    atualizarDuracaoSelecionada(
      event.target.value === "" ? 7 : event.target.value,
    );
  });
}

$("amostrasTexto").addEventListener("click", (event) => {
  const botao = event.target.closest("[data-color]");
  if (!botao) return;
  $("corTexto").value = botao.dataset.color;
  atualizarConfiguracao("cor", botao.dataset.color);
});

$("amostrasFundo").addEventListener("click", (event) => {
  const botao = event.target.closest("[data-bg]");
  if (!botao) return;
  $("fundoCor").value = botao.dataset.bg;
  atualizarFundo();
  salvarRascunhoLocal();
});

$("fundoCor").addEventListener("input", () => {
  atualizarFundo();
  salvarRascunhoLocal();
});

fundoImagem.addEventListener("change", () => {
  if (fundoImagemUrl) URL.revokeObjectURL(fundoImagemUrl);
  const arquivo = fundoImagem.files?.[0];
  fundoImagemUrl = arquivo ? URL.createObjectURL(arquivo) : null;
  atualizarFundo();
});

$("removerFundoImagem").addEventListener("click", () => {
  if (fundoImagemUrl) URL.revokeObjectURL(fundoImagemUrl);
  fundoImagemUrl = null;
  fundoImagem.value = "";
  atualizarFundo();
});

musicaArquivo.addEventListener("change", () => {
  if (musicaUrl) URL.revokeObjectURL(musicaUrl);
  musicaUrl = null;
  audioMusica.pause();
  audioMusica.removeAttribute("src");
  audioMusica.hidden = true;
  const arquivo = musicaArquivo.files?.[0];
  if (!arquivo) return;
  musicaUrl = URL.createObjectURL(arquivo);
  audioMusica.src = musicaUrl;
  audioMusica.hidden = false;
  audioMusica.load();
});

$("removerMusica").addEventListener("click", () => {
  audioMusica.pause();
  if (musicaUrl) URL.revokeObjectURL(musicaUrl);
  musicaUrl = null;
  musicaArquivo.value = "";
  audioMusica.removeAttribute("src");
  audioMusica.hidden = true;
  audioMusica.load();
});

botaoIniciar.addEventListener("click", iniciarPrevia);
botaoPausar.addEventListener("click", pausarPrevia);
botaoAnterior.addEventListener("click", () => {
  if (!slides.length) return;
  pausarPrevia();
  tempoDecorridoMs = 0;
  selecionarCena((indiceAtual - 1 + slides.length) % slides.length, {
    parar: false,
  });
});
botaoProxima.addEventListener("click", () => {
  if (!slides.length) return;
  pausarPrevia();
  tempoDecorridoMs = 0;
  selecionarCena((indiceAtual + 1) % slides.length, { parar: false });
});

$("salvarProjeto").addEventListener("click", () => {
  if (!slides.length) {
    $("statusProjeto").textContent =
      "Carregue as fotografias antes de salvar o projeto.";
    return;
  }

  salvarRascunhoLocal();
  const projeto = {
    app: "Memora",
    evento: EVENTO,
    eventoId: EVENTO_ID,
    nomeEvento: eventoNome,
    fundoCor: $("fundoCor").value,
    cenas: serializarSlides(),
    salvoEm: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(projeto, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `memora-projeto-${EVENTO || "evento"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  $("statusProjeto").textContent =
    "Rascunho salvo neste navegador e cópia de segurança JSON baixada. " +
    "A música e a imagem de fundo locais precisam ser selecionadas novamente ao reabrir.";
});

$("compartilharProjeto").addEventListener("click", async () => {
  const url = window.location.href;
  const texto = `Estou preparando o vídeo de recordações${eventoNome ? ` de ${eventoNome}` : ""} no Memora.`;
  try {
    if (navigator.share) {
      await navigator.share({
        title: "Vídeo de Recordações | Memora",
        text: texto,
        url,
      });
      $("statusProjeto").textContent = "Link compartilhado.";
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      $("statusProjeto").textContent =
        "Link do editor copiado. Ele abre o editor, mas não compartilha automaticamente o projeto salvo.";
    } else {
      window.prompt("Copie o link do editor:", url);
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      $("statusProjeto").textContent =
        "Não foi possível compartilhar automaticamente. Copie o endereço do navegador.";
    }
  }
});

$("baixarVideo").addEventListener("click", () => {
  $("statusProjeto").textContent =
    "A exportação real para MP4 ainda não está implementada. Por enquanto, você pode salvar o projeto JSON.";
});

window.addEventListener("pagehide", () => {
  pausarPrevia();
  limparAnimacaoAtual();
  if (musicaUrl) URL.revokeObjectURL(musicaUrl);
  if (fundoImagemUrl) URL.revokeObjectURL(fundoImagemUrl);
});

atualizarBotoes();
carregarEventoEFotos();
