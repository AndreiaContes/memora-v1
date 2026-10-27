const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = "fotos-eventos";
const EVENTO = new URLSearchParams(location.search).get("evento") || "default";
const EVENTO_ID = new URLSearchParams(location.search).get("eventoId") || "";

const LOTE_FOTOS = 12;
const FOTOS_POR_PAGINA = 2;

const galeria = document.getElementById("galeria");
const status = document.getElementById("status");
const quantidade = document.getElementById("quantidade");
const botaoProxima = document.getElementById("carregarMais");
const botaoAnterior = document.getElementById("botaoAnterior");
const botaoSelecionarTodas = document.getElementById("selecionarTodas");
const botaoLimparSelecao = document.getElementById("limparSelecao");
const botaoVisualizar = document.getElementById("visualizarAlbum");
const botaoVoltar = document.getElementById("voltarEdicao");
const previaCapa = document.getElementById("previaCapa");
const previaAlbum = document.getElementById("previaAlbum");
const mensagemFinal = document.getElementById("mensagemFinal");

const seletorPosicaoMural = document.getElementById("posicaoMuralAlbum");
const botaoAdicionarMural = document.getElementById("adicionarMuralAlbum");
const botaoRemoverMural = document.getElementById("removerMuralAlbum");
const statusMuralAlbum = document.getElementById("statusMuralAlbum");

const ajustesFotosCapa = new Map();
const posicoesTextosCapa = new Map();
const layoutsPaginas = new Map();
const tiposPaginas = new Map();
const ajustesFotosInternas = new Map();
const elementosMemoriaPaginas = new Map();
const posicoesFotosPagina = new Map(); // deslocamento de cada foto pela página (em % da largura)
let ordemAlbum = []; // ordem das fotos no álbum (permite trocar uma foto por outra)

let layoutPadraoAlbum = "elegante";
let mensagensMuralAlbum = [];
let nomeEventoMuralAlbum = "";
let muralAdicionadoAoAlbum = false;
let posicaoMuralAposPaginaFoto = 0;
let muralAlbumCarregado = false;

let fotos = [];
let paginaAtual = 0;
let fotoCapa = null;
let usarFotoNaCapa = false;
let chaveAjusteFoto = "";
let modeloCapa = "classico";
let ajusteFotoCapa = { x: 0, y: 0, zoom: 1, rotacao: 0 };

const selecionadas = new Set();
const urlsFotos = new Map();

const fundosCapa = {
  classico: "img/capas/capa-classica.png",
  minimalista: "img/capas/capa-minimalista.png",
  florido: "img/capas/capa-florida.png",
  moderno: "img/capas/capa-moderna.png",
  fotografico: "img/capas/capa-fotografica.png",
  contemporaneo: "img/capas/capa-contemporanea.png",
  mural: "img/mural-postits-sem-texto.png",
};

const coresAutomaticas = {
  classico: "#57351f",
  minimalista: "#57351f",
  florido: "#8b4055",
  moderno: "#d8b15a",
  fotografico: "#57351f",
  contemporaneo: "#57351f",
  mural: "#ffffff",
};

/* =========================================================
   FOTOGRAFIAS DO EVENTO
========================================================= */

async function carregarFotos() {
  status.textContent = "Carregando fotografias do evento...";
  galeria.replaceChildren();
  botaoProxima.hidden = true;
  botaoAnterior.hidden = true;

  try {
    const { data, error } = await supabaseClient.storage
      .from(BUCKET)
      .list(EVENTO, {
        limit: 100,
        sortBy: { column: "name", order: "desc" },
      });

    if (error) throw error;

    fotos = (data || []).filter(
      (foto) =>
        foto.name &&
        foto.name !== ".emptyFolderPlaceholder" &&
        /\.(jpe?g|png|webp|gif|avif)$/i.test(foto.name),
    );

    if (!fotos.length) {
      status.textContent = "Nenhuma fotografia encontrada neste evento.";
      atualizarQuantidade();
      renderizarCapa();
      return;
    }

    renderizarPagina();
  } catch (erro) {
    console.error("Erro ao carregar fotografias:", erro);
    status.textContent =
      "Não foi possível carregar as fotografias. Verifique a conexão e tente novamente.";
  }
}

function obterUrl(foto) {
  if (!foto) return "";

  if (!urlsFotos.has(foto.name)) {
    const caminho = `${EVENTO}/${foto.name}`;
    const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(caminho);

    urlsFotos.set(foto.name, data.publicUrl);
  }

  return urlsFotos.get(foto.name);
}

/* Pede ao Supabase uma versão reduzida da foto (mais leve).
   Se o projeto não oferecer redimensionamento, usa o original. */
let transformacaoImagemIndisponivel = false;

try {
  transformacaoImagemIndisponivel =
    sessionStorage.getItem("memora:sem-transformacao") === "1";
} catch (_) {}

function definirSrcOtimizado(imagem, foto, largura) {
  const original = obterUrl(foto);

  imagem.decoding = "async";

  if (transformacaoImagemIndisponivel) {
    imagem.src = original;
    return;
  }

  const { data } = supabaseClient.storage
    .from(BUCKET)
    .getPublicUrl(`${EVENTO}/${foto.name}`, {
      transform: { width: largura, quality: 70 },
    });

  imagem.addEventListener(
    "error",
    () => {
      transformacaoImagemIndisponivel = true;

      try {
        sessionStorage.setItem("memora:sem-transformacao", "1");
      } catch (_) {}

      console.info(
        "Memora: redimensionamento de imagens indisponível, usando as fotos originais.",
      );

      imagem.src = original;
    },
    { once: true },
  );

  imagem.src = data.publicUrl;
}

function renderizarPagina() {
  galeria.replaceChildren();

  const totalPaginas = Math.ceil(fotos.length / LOTE_FOTOS);
  const inicio = paginaAtual * LOTE_FOTOS;
  const fim = Math.min(inicio + LOTE_FOTOS, fotos.length);
  const fragmento = document.createDocumentFragment();

  for (const foto of fotos.slice(inicio, fim)) {
    const item = document.createElement("div");
    item.className = "foto-item";

    const imagem = document.createElement("img");
    definirSrcOtimizado(imagem, foto, 400);
    imagem.alt = "Fotografia do evento";
    imagem.loading = "lazy";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = foto.name;
    checkbox.checked = selecionadas.has(foto.name);

    const labelSelecao = document.createElement("label");
    labelSelecao.append(checkbox, document.createTextNode(" Incluir no álbum"));

    const checkboxCapa = document.createElement("input");
    checkboxCapa.type = "checkbox";
    checkboxCapa.value = foto.name;
    checkboxCapa.checked = usarFotoNaCapa && fotoCapa === foto.name;

    const labelCapa = document.createElement("label");
    labelCapa.className = "escolha-capa";
    labelCapa.append(checkboxCapa, document.createTextNode(" Usar como capa"));

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selecionadas.add(foto.name);
      } else {
        selecionadas.delete(foto.name);
      }

      atualizarQuantidade();
      atualizarPreviaExistente();
    });

    checkboxCapa.addEventListener("change", () => {
      if (checkboxCapa.checked) {
        usarFotoNaCapa = true;
        fotoCapa = foto.name;

        galeria
          .querySelectorAll('.foto-item input[data-controle="capa"]')
          .forEach((controle) => {
            controle.checked = controle.value === foto.name;
          });
      } else if (fotoCapa === foto.name) {
        usarFotoNaCapa = false;
        fotoCapa = null;
      }

      atualizarPreviaExistente();
      renderizarPagina();
    });

    checkboxCapa.dataset.controle = "capa";

    item.append(imagem, labelSelecao, labelCapa);
    fragmento.appendChild(item);
  }

  galeria.appendChild(fragmento);

  status.textContent = `Página ${paginaAtual + 1} de ${totalPaginas} · Fotos ${inicio + 1} a ${fim} de ${fotos.length}`;

  botaoAnterior.hidden = paginaAtual === 0;
  botaoProxima.hidden = paginaAtual >= totalPaginas - 1;

  atualizarQuantidade();
}

function atualizarControlesFotos() {
  galeria.querySelectorAll(".foto-item").forEach((item) => {
    const checkbox = item.querySelector(
      'input[type="checkbox"]:not([data-controle="capa"])',
    );

    const checkboxCapa = item.querySelector('input[data-controle="capa"]');

    if (checkbox) {
      checkbox.checked = selecionadas.has(checkbox.value);
    }

    if (checkboxCapa) {
      checkboxCapa.checked = usarFotoNaCapa && checkboxCapa.value === fotoCapa;
    }
  });
}

function atualizarQuantidade() {
  quantidade.textContent = `${selecionadas.size} foto(s) selecionada(s) de ${fotos.length}`;
}

botaoAnterior.addEventListener("click", () => {
  if (paginaAtual > 0) {
    paginaAtual--;
    renderizarPagina();
  }
});

botaoProxima.addEventListener("click", () => {
  const totalPaginas = Math.ceil(fotos.length / LOTE_FOTOS);

  if (paginaAtual < totalPaginas - 1) {
    paginaAtual++;
    renderizarPagina();
  }
});

botaoSelecionarTodas.addEventListener("click", () => {
  fotos.forEach((foto) => selecionadas.add(foto.name));

  if (!fotoCapa && fotos.length) {
    fotoCapa = fotos[0].name;
  }

  renderizarPagina();
  atualizarPreviaExistente();
});

botaoLimparSelecao.addEventListener("click", () => {
  selecionadas.clear();
  fotoCapa = null;
  ajusteFotoCapa = { x: 0, y: 0, zoom: 1, rotacao: 0 };
  chaveAjusteFoto = "";

  renderizarPagina();
  renderizarCapa();

  previaAlbum.replaceChildren();
  previaAlbum.hidden = true;
  botaoVoltar.hidden = true;
  mensagemFinal.textContent = "";
});

/* =========================================================
   CAPA DO ÁLBUM
========================================================= */

function formatarData(valor) {
  if (!valor) return "";

  const partes = valor.split("-");

  if (partes.length !== 3) return valor;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function renderizarCapa() {
  previaCapa.replaceChildren();

  const fotoEscolhida =
    usarFotoNaCapa && fotoCapa
      ? fotos.find((foto) => foto.name === fotoCapa)
      : null;

  const modelo = fundosCapa[modeloCapa] ? modeloCapa : "classico";
  const campoCor = document.getElementById("corTexto");
  const campoFrase = document.getElementById("fraseCapa");

  const corEscolhida = campoCor?.value || "auto";
  const corTexto =
    corEscolhida === "auto" ? coresAutomaticas[modelo] : corEscolhida;

  const capa = document.createElement("div");
  capa.className = `capa-preview tema-${modelo}`;
  capa.style.backgroundImage = `url("${fundosCapa[modelo]}")`;
  capa.style.setProperty("--cor-texto-capa", corTexto);

  if (modelo === "mural") {
    const mural = criarPaginaMuralAlbum(mensagensMuralAlbum.slice(0, 15), 1);

    capa.classList.add("capa-mural-preview");
    capa.style.backgroundImage = 'url("img/mural-postits-sem-texto.png")';

    while (mural.firstChild) {
      capa.appendChild(mural.firstChild);
    }

    previaCapa.appendChild(capa);
    return;
  }

  const conteudo = document.createElement("div");
  conteudo.className = "conteudo-capa";

  const titulo = document.createElement("h3");
  titulo.textContent = document.getElementById("titulo").value.trim();

  const nomes = document.createElement("div");
  nomes.className = "nomes";
  nomes.textContent = document.getElementById("nomes").value.trim();

  const frase = document.createElement("div");
  frase.className = "frase-capa";
  frase.textContent = campoFrase?.value.trim() || "";

  conteudo.append(titulo, nomes, frase);

  Object.assign(conteudo.style, {
    position: "absolute",
    inset: "0",
    zIndex: "10",
    pointerEvents: "none",
  });

  [titulo, nomes, frase].forEach((elemento) => {
    elemento.style.position = "relative";
    elemento.style.pointerEvents = "auto";
  });

  function tornarTextoArrastavel(elemento, identificador) {
    const chave = `${modeloCapa}:${identificador}`;

    if (!posicoesTextosCapa.has(chave)) {
      posicoesTextosCapa.set(chave, { x: 0, y: 0 });
    }

    const posicao = posicoesTextosCapa.get(chave);

    elemento.style.transform = `translate(${posicao.x}px, ${posicao.y}px)`;
    elemento.style.cursor = "grab";
    elemento.style.touchAction = "none";
    elemento.style.userSelect = "none";

    let arrastandoTexto = false;
    let inicioX = 0;
    let inicioY = 0;
    let origemX = 0;
    let origemY = 0;

    elemento.addEventListener("pointerdown", (evento) => {
      evento.preventDefault();
      evento.stopPropagation();

      arrastandoTexto = true;
      inicioX = evento.clientX;
      inicioY = evento.clientY;

      const atual = posicoesTextosCapa.get(chave);
      origemX = atual.x;
      origemY = atual.y;

      elemento.style.cursor = "grabbing";
      elemento.setPointerCapture(evento.pointerId);
    });

    elemento.addEventListener("pointermove", (evento) => {
      if (!arrastandoTexto) return;

      evento.preventDefault();

      const novaPosicao = {
        x: origemX + evento.clientX - inicioX,
        y: origemY + evento.clientY - inicioY,
      };

      posicoesTextosCapa.set(chave, novaPosicao);
      elemento.style.transform = `translate(${novaPosicao.x}px, ${novaPosicao.y}px)`;
    });

    function finalizarArraste() {
      arrastandoTexto = false;
      elemento.style.cursor = "grab";
    }

    elemento.addEventListener("pointerup", finalizarArraste);
    elemento.addEventListener("pointercancel", finalizarArraste);
  }

  tornarTextoArrastavel(titulo, "titulo");
  tornarTextoArrastavel(nomes, "nomes");
  tornarTextoArrastavel(frase, "frase");

  let janela = null;
  let camada = null;
  let imagem = null;

  if (fotoEscolhida) {
    janela = document.createElement("div");
    janela.className = "janela-foto";

    Object.assign(janela.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      overflow: "visible",
      borderRadius: "0",
      touchAction: "none",
      zIndex: "1",
      pointerEvents: "auto",
    });

    camada = document.createElement("div");
    camada.className = "camada-foto";

    imagem = document.createElement("img");
    imagem.className = "foto-ajustavel";
    definirSrcOtimizado(imagem, fotoEscolhida, 1400);
    imagem.alt = "Fotografia escolhida para a capa";
    imagem.draggable = false;

    const chaveAtual = `${modelo}:${fotoEscolhida.name}`;

    if (chaveAjusteFoto !== chaveAtual) {
      ajusteFotoCapa = {
        x: 0,
        y: 0,
        zoom: 1,
        rotacao: 0,
      };

      chaveAjusteFoto = chaveAtual;
    }

    camada.appendChild(imagem);
    janela.appendChild(camada);

    function aplicarAjuste() {
      camada.style.transform =
        `translate(-50%, -50%) ` +
        `translate(${ajusteFotoCapa.x}px, ${ajusteFotoCapa.y}px) ` +
        `rotate(${ajusteFotoCapa.rotacao}deg) ` +
        `scale(${ajusteFotoCapa.zoom})`;

      ajustesFotosCapa.set(chaveAtual, { ...ajusteFotoCapa });
    }

    const ponteiros = new Map();

    let arrastando = false;
    let inicioX = 0;
    let inicioY = 0;
    let posicaoX = 0;
    let posicaoY = 0;
    let distanciaInicial = 0;
    let anguloInicial = 0;
    let zoomInicial = 1;
    let rotacaoInicial = 0;

    function distancia(a, b) {
      return Math.hypot(b.x - a.x, b.y - a.y);
    }

    function angulo(a, b) {
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    }

    janela.addEventListener("pointerdown", (evento) => {
      evento.preventDefault();

      try {
        janela.setPointerCapture(evento.pointerId);
      } catch (_) {}

      ponteiros.set(evento.pointerId, {
        x: evento.clientX,
        y: evento.clientY,
      });

      if (ponteiros.size === 1) {
        inicioX = evento.clientX;
        inicioY = evento.clientY;
        posicaoX = ajusteFotoCapa.x;
        posicaoY = ajusteFotoCapa.y;
        arrastando = true;
      }

      if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        distanciaInicial = distancia(a, b);
        anguloInicial = angulo(a, b);
        zoomInicial = ajusteFotoCapa.zoom;
        rotacaoInicial = ajusteFotoCapa.rotacao;
        arrastando = false;
      }
    });

    janela.addEventListener("pointermove", (evento) => {
      if (!ponteiros.has(evento.pointerId)) return;

      evento.preventDefault();

      ponteiros.set(evento.pointerId, {
        x: evento.clientX,
        y: evento.clientY,
      });

      if (ponteiros.size === 1 && arrastando) {
        ajusteFotoCapa.x = posicaoX + evento.clientX - inicioX;
        ajusteFotoCapa.y = posicaoY + evento.clientY - inicioY;
      } else if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];

        if (distanciaInicial > 0) {
          ajusteFotoCapa.zoom = Math.max(
            0.05,
            Math.min(4, (zoomInicial * distancia(a, b)) / distanciaInicial),
          );
        }

        ajusteFotoCapa.rotacao = rotacaoInicial + angulo(a, b) - anguloInicial;
      }

      aplicarAjuste();
    });

    function terminarPonteiro(evento) {
      if (!ponteiros.has(evento.pointerId)) return;

      ponteiros.delete(evento.pointerId);

      if (ponteiros.size === 1) {
        const restante = [...ponteiros.values()][0];

        inicioX = restante.x;
        inicioY = restante.y;
        posicaoX = ajusteFotoCapa.x;
        posicaoY = ajusteFotoCapa.y;
        arrastando = true;
      } else {
        arrastando = false;
      }
    }

    janela.addEventListener("pointerup", terminarPonteiro);
    janela.addEventListener("pointercancel", terminarPonteiro);
    janela.addEventListener("lostpointercapture", terminarPonteiro);

    janela.addEventListener(
      "wheel",
      (evento) => {
        evento.preventDefault();

        ajusteFotoCapa.zoom += evento.deltaY < 0 ? 0.08 : -0.08;
        ajusteFotoCapa.zoom = Math.max(0.05, Math.min(4, ajusteFotoCapa.zoom));

        aplicarAjuste();
      },
      { passive: false },
    );

    // Guardado para uso após a inserção no DOM
    janela._aplicarAjuste = aplicarAjuste;
  }

  const data = document.createElement("div");
  tornarTextoArrastavel(data, "data");
  data.className = "data";
  data.textContent = formatarData(document.getElementById("dataEvento").value);

  if (janela) {
    capa.append(conteudo, janela, data);
  } else {
    capa.append(conteudo, data);
  }

  previaCapa.appendChild(capa);

  if (camada && imagem) {
    Object.assign(camada.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: "140%",
      height: "140%",
      transformOrigin: "center center",
    });

    Object.assign(imagem.style, {
      display: "block",
      width: "100%",
      height: "100%",
      maxWidth: "none",
      objectFit: "cover",
      pointerEvents: "none",
      userSelect: "none",
      border: "0",
      borderRadius: "0",
      boxShadow: "none",
    });

    const aplicar = janela._aplicarAjuste;

    if (imagem.complete && imagem.naturalWidth) {
      aplicar();
    } else {
      imagem.addEventListener("load", aplicar, { once: true });
    }
  }
}

/* =========================================================
   INTEGRAÇÃO DO MURAL DE RECADOS COM O ÁLBUM
========================================================= */

const POSICOES_POSTITS_ALBUM = [
  { left: "24%", top: "33%", width: "16%", height: "20%", rotation: "-5deg" },
  { left: "41%", top: "32%", width: "14%", height: "19%", rotation: "-5deg" },
  { left: "58%", top: "32%", width: "15%", height: "19%", rotation: "3deg" },
  { left: "75%", top: "32%", width: "14%", height: "20%", rotation: "5deg" },
  { left: "17%", top: "55%", width: "15%", height: "20%", rotation: "5deg" },
  { left: "32%", top: "55%", width: "14%", height: "20%", rotation: "-4deg" },
  { left: "49%", top: "55%", width: "15%", height: "20%", rotation: "1deg" },
  { left: "65%", top: "55%", width: "14%", height: "20%", rotation: "-5deg" },
  { left: "81%", top: "55%", width: "15%", height: "20%", rotation: "3deg" },
  { left: "14%", top: "77%", width: "14%", height: "20%", rotation: "-6deg" },
  { left: "28%", top: "77%", width: "14%", height: "20%", rotation: "-2deg" },
  { left: "42%", top: "77%", width: "14%", height: "20%", rotation: "5deg" },
  { left: "57%", top: "77%", width: "14%", height: "20%", rotation: "-1deg" },
  { left: "72%", top: "77%", width: "14%", height: "20%", rotation: "2deg" },
  { left: "88%", top: "77%", width: "14%", height: "20%", rotation: "5deg" },
];

async function carregarMensagensMuralAlbum() {
  if (statusMuralAlbum) {
    statusMuralAlbum.textContent =
      "Carregando mensagens publicadas do evento...";
  }

  if (!EVENTO_ID) {
    if (statusMuralAlbum) {
      statusMuralAlbum.textContent =
        "Abra o Editor de Álbum pelo Dashboard para identificar o evento e carregar seu mural.";
    }

    if (botaoAdicionarMural) {
      botaoAdicionarMural.disabled = true;
    }

    muralAlbumCarregado = false;
    return;
  }

  try {
    const [{ data, error }, { data: eventoData }] = await Promise.all([
      supabaseClient
        .from("mural_mensagens")
        .select("id, evento_id, nome, mensagem, status, created_at")
        .eq("evento_id", EVENTO_ID)
        .eq("status", "aprovada")
        .order("created_at", { ascending: true }),

      supabaseClient
        .from("eventos")
        .select("nome")
        .eq("id", EVENTO_ID)
        .maybeSingle(),
    ]);

    if (error) throw error;

    mensagensMuralAlbum = data || [];
    nomeEventoMuralAlbum = eventoData?.nome || "Memora";
    muralAlbumCarregado = true;

    console.info("Memora mural → mensagens recebidas:", mensagensMuralAlbum.length);

    mensagemFinal.textContent = `Mural: ${mensagensMuralAlbum.length} mensagem(ns) aprovada(s) carregada(s) do Supabase.`;

    if (statusMuralAlbum) {
      statusMuralAlbum.textContent = mensagensMuralAlbum.length
        ? `${mensagensMuralAlbum.length} mensagem(ns) publicada(s) disponível(is) para incluir no álbum.`
        : "Este evento ainda não tem mensagens publicadas para inserir no álbum.";
    }

    if (botaoAdicionarMural) {
      botaoAdicionarMural.disabled =
        mensagensMuralAlbum.length === 0 || previaAlbum.hidden;
    }

    renderizarCapa();

    if (!previaAlbum.hidden && typeof montarPreviaAlbum === "function") {
      montarPreviaAlbum();
    }
  } catch (erro) {
    console.error("Erro ao carregar mural para o álbum:", erro);

    muralAlbumCarregado = false;

    mensagemFinal.textContent = `Erro ao carregar o mural: ${erro.message || erro}`;

    if (statusMuralAlbum) {
      statusMuralAlbum.textContent =
        "Não foi possível carregar as mensagens publicadas. Confira o evento e as permissões do Supabase.";
    }

    if (botaoAdicionarMural) {
      botaoAdicionarMural.disabled = true;
    }
  }
}

function criarPaginaMuralAlbum(mensagensDaPagina, numeroMural) {
  const paginaMural = document.createElement("section");
  paginaMural.className = "album-pagina pagina-mural-album";
  paginaMural.dataset.tipoPagina = "mural";
  paginaMural.dataset.numeroMural = String(numeroMural);

  const logo = document.createElement("img");
  logo.className = "mural-album-logo";
  logo.src = "img/memora.png";
  logo.alt = "Memora";

  const cabecalho = document.createElement("div");
  cabecalho.className = "mural-album-cabecalho";
  cabecalho.appendChild(document.createTextNode("Mural de Recados"));

  const subtitulo = document.createElement("span");
  subtitulo.className = "mural-album-evento";
  subtitulo.textContent = nomeEventoMuralAlbum;
  cabecalho.appendChild(subtitulo);

  const camadaPostits = document.createElement("div");
  camadaPostits.className = "camada-postits-album";

  mensagensDaPagina.forEach((mensagem, indice) => {
    const posicao = POSICOES_POSTITS_ALBUM[indice];
    if (!posicao) return;

    const postit = document.createElement("div");
    postit.className = "postit-album-item";
    postit.style.setProperty("--left", posicao.left);
    postit.style.setProperty("--top", posicao.top);
    postit.style.setProperty("--width", posicao.width);
    postit.style.setProperty("--height", posicao.height);
    postit.style.setProperty("--rotation", posicao.rotation);

    const texto = document.createElement("span");
    texto.className = "postit-album-texto";
    texto.textContent = mensagem.mensagem || "";
    texto.title = mensagem.mensagem || "";

    const nome = document.createElement("span");
    nome.className = "postit-album-nome";
    nome.textContent = `— ${mensagem.nome || "Convidado"}`;

    postit.append(texto, nome);
    camadaPostits.appendChild(postit);
  });

  paginaMural.append(logo, cabecalho, camadaPostits);
  return paginaMural;
}

function adicionarPaginasMuralNaPrevia() {
  if (!mensagensMuralAlbum.length) return;

  let numeroMural = 1;

  for (let inicio = 0; inicio < mensagensMuralAlbum.length; inicio += 15) {
    const mensagensDaPagina = mensagensMuralAlbum.slice(inicio, inicio + 15);

    previaAlbum.appendChild(
      criarPaginaMuralAlbum(mensagensDaPagina, numeroMural),
    );

    numeroMural++;
  }
}

function atualizarControlePosicaoMural(totalPaginasFotos) {
  if (!seletorPosicaoMural) return;

  posicaoMuralAposPaginaFoto = Math.max(
    0,
    Math.min(posicaoMuralAposPaginaFoto, totalPaginasFotos),
  );

  const valorAnterior = String(posicaoMuralAposPaginaFoto);
  seletorPosicaoMural.replaceChildren();

  for (let posicao = 0; posicao <= totalPaginasFotos; posicao++) {
    const opcao = document.createElement("option");

    opcao.value = String(posicao);
    opcao.textContent =
      posicao === 0
        ? "Logo após a capa"
        : `Após a página de fotografias ${posicao}`;

    seletorPosicaoMural.appendChild(opcao);
  }

  seletorPosicaoMural.value = valorAnterior;
  seletorPosicaoMural.disabled =
    !muralAlbumCarregado || mensagensMuralAlbum.length === 0;

  if (botaoAdicionarMural) {
    botaoAdicionarMural.hidden = muralAdicionadoAoAlbum;
    botaoAdicionarMural.disabled =
      !muralAlbumCarregado || mensagensMuralAlbum.length === 0;
  }

  if (botaoRemoverMural) {
    botaoRemoverMural.hidden = !muralAdicionadoAoAlbum;
  }
}

function calcularTotalPaginasFotos(fotosInternas, estilos) {
  let indice = 0;
  let numero = 1;

  while (indice < fotosInternas.length) {
    const chave = `pagina-${numero}`;
    const layout = layoutsPaginas.get(chave) || layoutPadraoAlbum;
    const estilo = estilos[layout] || estilos.elegante;

    indice += Math.max(1, estilo.quantidade);
    numero++;
  }

  return numero - 1;
}

/* =========================================================
   SELEÇÃO DE ELEMENTOS (listener único)
========================================================= */

// Clicar fora de qualquer elemento ou controle limpa a seleção.
// Registrado uma única vez, e não a cada renderização da prévia.
previaAlbum.addEventListener("pointerdown", (evento) => {
  if (
    evento.target.closest(
      ".item-memoria, .bloco-controles-pagina, .formatacao-memoria, .ferramentas-memoria, .seletor-layout-pagina",
    )
  ) {
    return;
  }

  previaAlbum
    .querySelectorAll(".item-memoria.selecionado")
    .forEach((elemento) => elemento.classList.remove("selecionado"));
});

/* =========================================================
   MONTAGEM DA PRÉ-VISUALIZAÇÃO DO ÁLBUM
========================================================= */

/* Mantém a ordem das fotos do álbum, sincronizada com as fotos marcadas. */
function obterFotosAlbumOrdenadas() {
  if (!fotos.length) return [];

  ordemAlbum = ordemAlbum.filter(
    (nome) => selecionadas.has(nome) && fotos.some((f) => f.name === nome),
  );

  fotos.forEach((foto) => {
    if (selecionadas.has(foto.name) && !ordemAlbum.includes(foto.name)) {
      ordemAlbum.push(foto.name);
    }
  });

  return ordemAlbum.map((nome) => fotos.find((f) => f.name === nome));
}

/* Janela para escolher uma foto do evento. */
function abrirSeletorFotoEvento({ titulo, nomeAtual, aoEscolher }) {
  const modal = document.createElement("div");
  modal.className = "modal-fotos-capa";

  const painel = document.createElement("section");
  painel.className = "painel-fotos-capa";
  painel.setAttribute("role", "dialog");
  painel.setAttribute("aria-modal", "true");
  painel.setAttribute("aria-label", titulo);

  const cabecalho = document.createElement("div");
  cabecalho.className = "cabecalho-fotos-capa";

  const tituloEl = document.createElement("h3");
  tituloEl.textContent = titulo;

  const fechar = document.createElement("button");
  fechar.type = "button";
  fechar.className = "botao botao-secundario";
  fechar.textContent = "Fechar";
  fechar.addEventListener("click", () => modal.remove());

  cabecalho.append(tituloEl, fechar);

  const grade = document.createElement("div");
  grade.className = "grade-fotos-capa";

  fotos.forEach((foto) => {
    const ehAtual = foto.name === nomeAtual;
    const naCapa = usarFotoNaCapa && foto.name === fotoCapa;
    const noAlbum = selecionadas.has(foto.name);

    const opcao = document.createElement("button");
    opcao.type = "button";
    opcao.className = "opcao-foto-capa";
    opcao.disabled = ehAtual || naCapa;
    opcao.style.opacity = ehAtual || naCapa ? "0.45" : "1";
    opcao.style.cursor = ehAtual || naCapa ? "not-allowed" : "pointer";

    const imagem = document.createElement("img");
    definirSrcOtimizado(imagem, foto, 300);
    imagem.alt = foto.name;
    imagem.loading = "lazy";

    const rotulo = document.createElement("span");
    rotulo.textContent = ehAtual
      ? "Foto atual"
      : naCapa
        ? "Está na capa"
        : noAlbum
          ? "Já no álbum (troca de lugar)"
          : "";
    Object.assign(rotulo.style, {
      display: "block",
      marginTop: "4px",
      font: "11px Arial, sans-serif",
      color: "#705b4d",
      minHeight: "14px",
    });

    opcao.append(imagem, rotulo);

    opcao.addEventListener("click", () => {
      modal.remove();
      aoEscolher(foto);
    });

    grade.appendChild(opcao);
  });

  painel.append(cabecalho, grade);
  modal.appendChild(painel);

  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}

/* Troca uma foto do álbum por outra, mantendo o quadro e a posição. */
function trocarFotoNoAlbum(nomeAtual, nomeNovo) {
  if (!nomeNovo || nomeAtual === nomeNovo) return;

  obterFotosAlbumOrdenadas();

  const i = ordemAlbum.indexOf(nomeAtual);
  if (i === -1) return;

  const j = ordemAlbum.indexOf(nomeNovo);

  const posAtual = posicoesFotosPagina.get(nomeAtual);
  const posNova = posicoesFotosPagina.get(nomeNovo);

  if (j !== -1) {
    // A foto escolhida já está no álbum: as duas trocam de lugar
    ordemAlbum[i] = nomeNovo;
    ordemAlbum[j] = nomeAtual;

    posicoesFotosPagina.delete(nomeAtual);
    posicoesFotosPagina.delete(nomeNovo);
    if (posNova) posicoesFotosPagina.set(nomeAtual, posNova);
    if (posAtual) posicoesFotosPagina.set(nomeNovo, posAtual);
  } else {
    ordemAlbum[i] = nomeNovo;

    selecionadas.delete(nomeAtual);
    selecionadas.add(nomeNovo);

    posicoesFotosPagina.delete(nomeAtual);
    if (posAtual) posicoesFotosPagina.set(nomeNovo, posAtual);
  }

  renderizarPagina();
  montarPreviaAlbum();
}

function montarPreviaAlbum() {
  previaAlbum.replaceChildren();

  if (selecionadas.size === 0) {
    mensagemFinal.textContent =
      "Selecione pelo menos uma fotografia para visualizar o álbum.";

    previaAlbum.hidden = true;
    return;
  }

  if (usarFotoNaCapa && !fotoCapa) {
    usarFotoNaCapa = false;
  }

  renderizarCapa();

  const capaNaPrevia = previaCapa.querySelector(".capa-preview");

  if (capaNaPrevia) {
    previaAlbum.appendChild(capaNaPrevia.cloneNode(true));

    if (muralAdicionadoAoAlbum && posicaoMuralAposPaginaFoto === 0) {
      adicionarPaginasMuralNaPrevia();
    }
  }

  const fotosSelecionadas = obterFotosAlbumOrdenadas();

  const fotosInternas = fotosSelecionadas.filter(
    (foto) => !usarFotoNaCapa || foto.name !== fotoCapa,
  );

  const seletorPadrao = document.getElementById("layoutPadrao");

  if (seletorPadrao) {
    seletorPadrao.value = layoutPadraoAlbum;

    seletorPadrao.onchange = () => {
      layoutPadraoAlbum = seletorPadrao.value;
      montarPreviaAlbum();
    };
  }

  const estilos = {
    elegante: { nome: "Elegante", quantidade: 1 },
    scrapbook: { nome: "Scrapbook", quantidade: 4 },
    editorial: { nome: "Editorial", quantidade: 2 },
    afetivo: { nome: "Afetivo", quantidade: 2 },
  };

  const totalPaginasFotoPrevistas = calcularTotalPaginasFotos(
    fotosInternas,
    estilos,
  );

  posicaoMuralAposPaginaFoto = Math.min(
    posicaoMuralAposPaginaFoto,
    totalPaginasFotoPrevistas,
  );

  let indiceFoto = 0;
  let numeroPagina = 1;

  while (indiceFoto < fotosInternas.length) {
    const chavePagina = `pagina-${numeroPagina}`;

    if (!layoutsPaginas.has(chavePagina)) {
      layoutsPaginas.set(chavePagina, layoutPadraoAlbum);
    }

    const layout = layoutsPaginas.get(chavePagina);
    const estilo = estilos[layout] || estilos.elegante;

    const fotosDestaPagina = fotosInternas.slice(
      indiceFoto,
      indiceFoto + estilo.quantidade,
    );

    const pagina = document.createElement("section");
    pagina.className = `album-pagina layout-${layout}`;
    pagina.style.position = "relative";
    pagina.style.containerType = "inline-size";

    const seletorTipoPagina = document.createElement("select");
    seletorTipoPagina.className = "seletor-tipo-pagina";
    seletorTipoPagina.setAttribute(
      "aria-label",
      `Tipo da página ${numeroPagina}`,
    );

    [
      ["fotografias", "Fotografias"],
      ["mural", "Mural de Recados"],
    ].forEach(([valor, nome]) => {
      const opcao = document.createElement("option");
      opcao.value = valor;
      opcao.textContent = nome;
      seletorTipoPagina.appendChild(opcao);
    });

    seletorTipoPagina.value = tiposPaginas.get(chavePagina) || "fotografias";

    const seletorPagina = document.createElement("select");
    seletorPagina.className = "seletor-layout-pagina";
    seletorPagina.setAttribute(
      "aria-label",
      `Estilo da página ${numeroPagina}`,
    );

    for (const [valor, definicao] of Object.entries(estilos)) {
      const opcao = document.createElement("option");
      opcao.value = valor;
      opcao.textContent = definicao.nome;
      seletorPagina.appendChild(opcao);
    }

    seletorPagina.value = layout;

    seletorTipoPagina.addEventListener("change", () => {
      tiposPaginas.set(chavePagina, seletorTipoPagina.value);
      montarPreviaAlbum();
    });

    seletorPagina.addEventListener("change", () => {
      layoutsPaginas.set(chavePagina, seletorPagina.value);
      montarPreviaAlbum();
    });

    if (seletorTipoPagina.value === "mural") {
      pagina.className = "album-pagina pagina-mural-album";

      // Os seletores ficam FORA da página, para não alterar suas dimensões
      const controlesMural = document.createElement("div");
      controlesMural.className =
        "bloco-controles-pagina controles-pagina-album";
      controlesMural.append(seletorTipoPagina, seletorPagina);
      previaAlbum.appendChild(controlesMural);

      const numeroMural =
        [...tiposPaginas.entries()].filter(
          ([chave, tipo]) =>
            tipo === "mural" &&
            Number(chave.replace("pagina-", "")) < numeroPagina,
        ).length + 1;

      const inicioMensagens = (numeroMural - 1) * 15;
      const mensagensDaPagina = mensagensMuralAlbum.slice(
        inicioMensagens,
        inicioMensagens + 15,
      );

      if (mensagensDaPagina.length) {
        const muralVisual = criarPaginaMuralAlbum(
          mensagensDaPagina,
          numeroMural,
        );

        while (muralVisual.firstChild) {
          pagina.appendChild(muralVisual.firstChild);
        }
      } else {
        const aviso = document.createElement("p");
        aviso.textContent =
          "Não há mensagens aprovadas disponíveis para esta página.";
        pagina.appendChild(aviso);
      }

      previaAlbum.appendChild(pagina);
      numeroPagina++;
      continue;
    }

    const tituloPagina = document.createElement("h3");
    const tituloAlbum = document.getElementById("titulo").value.trim();

    tituloPagina.textContent = tituloAlbum
      ? `${tituloAlbum} · Página ${numeroPagina}`
      : `Página ${numeroPagina}`;

    const grade = document.createElement("div");
    grade.className = "fotos-pagina";

    const estiloMemoriasId = "memora-estilos-memorias";

    if (!document.getElementById(estiloMemoriasId)) {
      const estiloMemorias = document.createElement("style");
      estiloMemorias.id = estiloMemoriasId;

      estiloMemorias.textContent = `
    .ferramentas-memoria {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px;
      margin: 12px 0;
      border: 1px solid #e4c8a7;
      border-radius: 12px;
      background: #fffaf4;
    }

    .ferramentas-memoria button,
    .painel-memoria button {
      border: 1px solid #dfbd91;
      border-radius: 20px;
      padding: 8px 12px;
      background: #fff;
      color: #57351f;
      cursor: pointer;
    }

    .formatacao-memoria {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 12px;
      margin-bottom: 12px;
      border: 1px solid #e4c8a7;
      border-radius: 12px;
      background: #fffaf4;
      font: 13px Arial, sans-serif;
    }

    .formatacao-memoria label {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .formatacao-memoria select,
    .formatacao-memoria input {
      max-width: 130px;
    }

    .camada-memorias {
      position: absolute;
      inset: 0;
      z-index: 8;
      pointer-events: none;
    }

    .item-memoria {
      position: absolute;
      pointer-events: auto;
      box-sizing: border-box;
      user-select: text;
      -webkit-user-select: text;
    }

    .item-memoria.selecionado {
      outline: 1px dashed #b9853e;
      outline-offset: 3px;
    }

    .item-memoria .botao-excluir-memoria {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }

    .item-memoria.selecionado .botao-excluir-memoria,
    .item-memoria:hover .botao-excluir-memoria,
    .item-memoria:focus-within .botao-excluir-memoria {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .item-memoria .conteudo-memoria {
      min-width: 35px;
      min-height: 24px;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      outline: none;
    }

    .item-memoria.postit {
      width: 150px;
      height: 125px;
      min-width: 90px;
      min-height: 65px;
      max-width: 75%;
      max-height: 80%;
      padding: 12px;
      overflow: auto;
      resize: both;
      box-shadow: 2px 4px 10px #0002;
    }

    .postit-amarelo { background: #fff0a8; }
    .postit-rosa { background: #ffd7e4; }
    .postit-azul { background: #d5ecff; }
    .postit-lilas { background: #e8ddff; }
    .postit-verde { background: #d9f3d5; }
    .postit-pessego { background: #ffdfca; }

    .item-memoria.emoji-memoria {
      min-width: 0;
      min-height: 0;
      padding: 2px;
      background: transparent;
      box-shadow: none;
      cursor: grab;
      font-family: sans-serif;
      line-height: 1.2;
    }

    .item-memoria.fita-memoria {
      min-width: 65px;
      min-height: 20px;
      height: 26px;
      padding: 0;
      background: #f4d6a5cc;
      border: 1px solid #d6b783aa;
      box-shadow: 0 1px 3px #0002;
      cursor: grab;
    }

    .item-memoria.fita-memoria .conteudo-memoria {
      display: none;
    }

    .painel-memoria-fundo {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #24190dcc;
    }

    .painel-memoria {
      width: min(440px, 100%);
      max-height: 80vh;
      overflow: auto;
      padding: 22px;
      border-radius: 18px;
      background: #fffaf4;
      box-shadow: 0 18px 60px #0004;
      color: #57351f;
      font-family: Arial, sans-serif;
    }

    .painel-memoria h3 {
      margin: 0 0 8px;
      font-size: 20px;
    }

    .painel-memoria p {
      margin: 0 0 16px;
      color: #806b59;
      font-size: 13px;
    }

    .opcoes-memoria {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .opcoes-memoria button {
      min-height: 58px;
      border-radius: 10px;
    }

    .opcoes-memoria .amostra-postit {
      border: 1px solid #d9c6ad;
      font-size: 12px;
    }

    .opcoes-memoria .amostra-emoji {
      font-size: 28px;
    }

    .acoes-painel-memoria {
      display: flex;
      justify-content: flex-end;
      margin-top: 18px;
    }
  `;

      document.head.appendChild(estiloMemorias);
    }

    const ferramentas = document.createElement("div");
    ferramentas.className = "ferramentas-memoria";

    const botaoTexto = document.createElement("button");
    botaoTexto.type = "button";
    botaoTexto.textContent = "✍️ Texto";

    const botaoPostit = document.createElement("button");
    botaoPostit.type = "button";
    botaoPostit.textContent = "📝 Post-it";

    const botaoEmoji = document.createElement("button");
    botaoEmoji.type = "button";
    botaoEmoji.textContent = "💖 Adesivos";

    const botaoFita = document.createElement("button");
    botaoFita.type = "button";
    botaoFita.textContent = "🎀 Fita";

    ferramentas.append(botaoTexto, botaoPostit, botaoEmoji, botaoFita);

    const formatacao = document.createElement("div");
    formatacao.className = "formatacao-memoria";

    const fonte = document.createElement("select");
    fonte.setAttribute("aria-label", "Fonte do texto");

    [
      ["Georgia", "Georgia"],
      ["Arial", "Arial"],
      ["'Times New Roman'", "Times New Roman"],
      ["'Courier New'", "Courier New"],
      ["'Trebuchet MS'", "Trebuchet MS"],
      ["Verdana", "Verdana"],
    ].forEach(([valor, nome]) => {
      const opcao = document.createElement("option");

      opcao.value = valor;
      opcao.textContent = nome;

      fonte.appendChild(opcao);
    });

    const tamanhoFonte = document.createElement("input");
    tamanhoFonte.type = "number";
    tamanhoFonte.min = "8";
    tamanhoFonte.max = "72";
    tamanhoFonte.value = "16";
    tamanhoFonte.title = "Tamanho da fonte";
    tamanhoFonte.setAttribute("aria-label", "Tamanho da fonte");

    const corFonte = document.createElement("input");
    corFonte.type = "hidden";
    corFonte.value = "#57351f";
    corFonte.title = "Cor da fonte";
    corFonte.setAttribute("aria-label", "Cor da fonte");

    const alinhamento = document.createElement("select");
    alinhamento.setAttribute("aria-label", "Alinhamento do texto");

    [
      ["left", "Esquerda"],
      ["center", "Centralizado"],
      ["right", "Direita"],
      ["justify", "Justificado"],
    ].forEach(([valor, nome]) => {
      const opcao = document.createElement("option");

      opcao.value = valor;
      opcao.textContent = nome;

      alinhamento.appendChild(opcao);
    });

    const tamanhoElemento = document.createElement("input");
    tamanhoElemento.type = "range";
    tamanhoElemento.min = "40";
    tamanhoElemento.max = "300";
    tamanhoElemento.value = "100";
    tamanhoElemento.title = "Tamanho do elemento";
    tamanhoElemento.setAttribute("aria-label", "Tamanho do elemento");

    const rotacaoElemento = document.createElement("input");
    rotacaoElemento.type = "range";
    rotacaoElemento.min = "-180";
    rotacaoElemento.max = "180";
    rotacaoElemento.value = "0";
    rotacaoElemento.title = "Rotação do elemento";
    rotacaoElemento.setAttribute("aria-label", "Rotação do elemento");

    const camadaMemorias = document.createElement("div");
    camadaMemorias.className = "camada-memorias";
    camadaMemorias.setAttribute(
      "aria-label",
      "Elementos decorativos da página",
    );

    if (!elementosMemoriaPaginas.has(chavePagina)) {
      elementosMemoriaPaginas.set(chavePagina, []);
    }

    const memorias = elementosMemoriaPaginas.get(chavePagina);
    let itemSelecionado = null;

    function selecionarElemento(item, memoria) {
      previaAlbum
        .querySelectorAll(".item-memoria.selecionado")
        .forEach((elemento) => {
          elemento.classList.remove("selecionado");
        });

      item.classList.add("selecionado");
      itemSelecionado = item;

      fonte.value = memoria.fonte || "Georgia";
      tamanhoFonte.value = memoria.tamanhoFonte || 16;
      corFonte.value = memoria.corFonte || "#57351f";
      alinhamento.value = memoria.alinhamento || "left";
      tamanhoElemento.value = memoria.escala || 100;
      rotacaoElemento.value = memoria.rotacao || 0;
    }

    function atualizarElementoSelecionado() {
      if (
        !itemSelecionado ||
        !itemSelecionado.classList.contains("selecionado")
      ) {
        return;
      }

      const memoria = memorias.find(
        (item) => item.id === itemSelecionado.dataset.id,
      );

      if (!memoria) return;

      memoria.fonte = fonte.value;
      memoria.tamanhoFonte = Number(tamanhoFonte.value) || 16;
      memoria.corFonte = corFonte.value || "#57351f";
      memoria.alinhamento = alinhamento.value;
      memoria.escala = Number(tamanhoElemento.value) || 100;
      memoria.rotacao = Number(rotacaoElemento.value) || 0;

      if (memoria.tipo === "fita-memoria") {
        memoria.escala = Math.max(40, Math.min(300, memoria.escala));
      }

      const conteudo = itemSelecionado.querySelector(".conteudo-memoria");

      if (conteudo) {
        conteudo.style.fontFamily = memoria.fonte;
        conteudo.style.color = memoria.corFonte;
        conteudo.style.textAlign = memoria.alinhamento;
        conteudo.style.fontSize = `${memoria.tipo === "emoji-memoria" ? Math.max(16, memoria.escala * 0.36) : memoria.tamanhoFonte}px`;
      }

      const escalaVisual =
        memoria.tipo === "fita-memoria" ? 1 : memoria.escala / 100;

      itemSelecionado.style.transform = `rotate(${memoria.rotacao}deg) scale(${escalaVisual})`;

      itemSelecionado.style.transformOrigin = "top left";

      if (memoria.tipo === "fita-memoria") {
        itemSelecionado.style.width = `${memoria.escala}px`;
        itemSelecionado.style.background = memoria.corFita || "#f4d6a5cc";
      }
    }

    function abrirPainelMemoria(titulo, descricao, opcoes, aoEscolher) {
      const fundo = document.createElement("div");
      fundo.className = "painel-memoria-fundo";

      const painel = document.createElement("section");
      painel.className = "painel-memoria";
      painel.setAttribute("role", "dialog");
      painel.setAttribute("aria-modal", "true");

      const cabecalho = document.createElement("h3");
      cabecalho.textContent = titulo;

      const texto = document.createElement("p");
      texto.textContent = descricao;

      const gradeOpcoes = document.createElement("div");
      gradeOpcoes.className = "opcoes-memoria";

      opcoes.forEach((opcao) => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = opcao.rotulo;
        botao.title = opcao.nome;
        botao.className = opcao.classeBotao || "";

        if (opcao.fundo) {
          botao.style.background = opcao.fundo;
        }

        botao.addEventListener("click", () => {
          fundo.remove();
          aoEscolher(opcao);
        });

        gradeOpcoes.appendChild(botao);
      });

      const acoes = document.createElement("div");
      acoes.className = "acoes-painel-memoria";

      const cancelar = document.createElement("button");
      cancelar.type = "button";
      cancelar.textContent = "Cancelar";
      cancelar.addEventListener("click", () => fundo.remove());

      acoes.appendChild(cancelar);
      painel.append(cabecalho, texto, gradeOpcoes, acoes);
      fundo.appendChild(painel);

      fundo.addEventListener("click", (evento) => {
        if (evento.target === fundo) fundo.remove();
      });

      document.body.appendChild(fundo);
    }

    function renderizarElementoMemoria(memoria) {
      const item = document.createElement("div");

      item.className =
        `item-memoria ${memoria.tipo} ${memoria.classe || ""}`.trim();

      item.dataset.id = memoria.id;
      item.style.left = memoria.left || "12%";
      item.style.top = memoria.top || "25%";

      if (memoria.width) item.style.width = memoria.width;
      if (memoria.height) item.style.height = memoria.height;

      const ehEmoji = memoria.tipo === "emoji-memoria";
      const ehFita = memoria.tipo === "fita-memoria";

      const conteudo = document.createElement("div");
      conteudo.className = "conteudo-memoria";

      if (ehEmoji || ehFita) {
        conteudo.textContent = memoria.conteudo;
      } else {
        try {
          // Texto simples: o Enter vira quebra de linha de verdade
          conteudo.contentEditable = "plaintext-only";
        } catch (_) {
          conteudo.contentEditable = "true";
        }
        conteudo.textContent = memoria.conteudo;
        conteudo.setAttribute("role", "textbox");
        conteudo.setAttribute("aria-label", "Editar texto da memória");
        conteudo.setAttribute("spellcheck", "true");

        conteudo.addEventListener("input", () => {
          memoria.conteudo = conteudo.innerText.replace(/\n+$/, "");
        });
      }

      item.appendChild(conteudo);

      const botaoExcluirElemento = document.createElement("button");

      botaoExcluirElemento.type = "button";
      botaoExcluirElemento.className = "botao-excluir-memoria";
      botaoExcluirElemento.textContent = "×";
      botaoExcluirElemento.title = "Excluir este elemento";
      botaoExcluirElemento.setAttribute("aria-label", "Excluir este elemento");

      Object.assign(botaoExcluirElemento.style, {
        position: "absolute",
        top: "2px",
        right: "2px",
        width: "24px",
        height: "24px",
        padding: "0",
        border: "1px solid #a33",
        borderRadius: "50%",
        background: "#fff",
        color: "#a33",
        font: "bold 18px Arial, sans-serif",
        cursor: "pointer",
        zIndex: "9999",
        pointerEvents: "auto",
      });

      botaoExcluirElemento.addEventListener("pointerdown", (evento) => {
        evento.stopPropagation();
      });

      botaoExcluirElemento.addEventListener("click", (evento) => {
        evento.preventDefault();
        evento.stopPropagation();

        const indice = memorias.findIndex(
          (elemento) => elemento.id === memoria.id,
        );

        if (indice !== -1) {
          memorias.splice(indice, 1);
        }

        if (itemSelecionado === item) {
          itemSelecionado = null;
        }

        item.remove();
      });

      item.appendChild(botaoExcluirElemento);

      function aplicarFormato() {
        conteudo.style.fontFamily = memoria.fonte || "Georgia";
        conteudo.style.fontSize = `${memoria.tamanhoFonte || 16}px`;
        conteudo.style.color = memoria.corFonte || "#57351f";
        conteudo.style.textAlign = memoria.alinhamento || "left";

        const escala = (memoria.escala || 100) / 100;
        const rotacao = memoria.rotacao || 0;

        item.style.transform = `rotate(${rotacao}deg) scale(${escala})`;
        item.style.transformOrigin = "top left";

        if (ehEmoji) {
          conteudo.style.fontSize = `${memoria.tamanhoFonte || 36}px`;
        }

        if (ehFita) {
          item.style.background = memoria.corFita || "#f4d6a5cc";
          item.style.width = `${memoria.escala || 100}px`;
          item.style.height = "26px";
        }
      }

      aplicarFormato();

      item.addEventListener("click", () => {
        selecionarElemento(item, memoria);
      });

      function iniciarMovimento(evento) {
        if (evento.button !== undefined && evento.button !== 0) return;

        if (!ehEmoji && !ehFita && evento.target === conteudo) return;

        evento.preventDefault();
        evento.stopPropagation();

        selecionarElemento(item, memoria);

        const inicioX = evento.clientX;
        const inicioY = evento.clientY;
        const largura = camadaMemorias.clientWidth;
        const altura = camadaMemorias.clientHeight;
        const esquerdaInicial = parseFloat(item.style.left) || 0;
        const topoInicial = parseFloat(item.style.top) || 0;

        function mover(ev) {
          if (!largura || !altura) return;

          const dx = ((ev.clientX - inicioX) / largura) * 100;
          const dy = ((ev.clientY - inicioY) / altura) * 100;

          item.style.left = `${Math.max(0, Math.min(90, esquerdaInicial + dx))}%`;

          item.style.top = `${Math.max(0, Math.min(90, topoInicial + dy))}%`;

          memoria.left = item.style.left;
          memoria.top = item.style.top;
        }

        function finalizar() {
          document.removeEventListener("pointermove", mover);
          document.removeEventListener("pointerup", finalizar);
          document.removeEventListener("pointercancel", finalizar);
        }

        document.addEventListener("pointermove", mover);
        document.addEventListener("pointerup", finalizar);
        document.addEventListener("pointercancel", finalizar);
      }

      if (ehEmoji || ehFita) {
        item.addEventListener("pointerdown", iniciarMovimento);
      } else {
        item.addEventListener("pointerdown", (evento) => {
          if (evento.target === item) iniciarMovimento(evento);
        });
      }

      if (!ehEmoji && !ehFita && window.ResizeObserver) {
        const observador = new ResizeObserver(() => {
          if (item.style.width) memoria.width = item.style.width;
          if (item.style.height) memoria.height = item.style.height;
        });

        observador.observe(item);
      }

      camadaMemorias.appendChild(item);

      return item;
    }

    function criarElementoMemoria(tipo, conteudo, classe = "", extras = {}) {
      const memoria = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        tipo,
        classe,
        conteudo,
        left: "12%",
        top: "25%",
        fonte: "Georgia",
        tamanhoFonte: tipo === "emoji-memoria" ? 36 : 16,
        corFonte: "#57351f",
        alinhamento: "left",
        escala: 100,
        rotacao: 0,
        ...extras,
      };

      memorias.push(memoria);

      const item = renderizarElementoMemoria(memoria);
      selecionarElemento(item, memoria);

      if (tipo !== "emoji-memoria" && tipo !== "fita-memoria") {
        item.querySelector(".conteudo-memoria")?.focus();
      }

      return item;
    }

    botaoTexto.addEventListener("click", () => {
      criarElementoMemoria("texto-livre", "Escreva sua memória aqui...");
    });

    botaoPostit.addEventListener("click", () => {
      const cores = [
        { nome: "Amarelo", classe: "postit-amarelo", fundo: "#fff0a8" },
        { nome: "Rosa", classe: "postit-rosa", fundo: "#ffd7e4" },
        { nome: "Azul", classe: "postit-azul", fundo: "#d5ecff" },
        { nome: "Lilás", classe: "postit-lilas", fundo: "#e8ddff" },
        { nome: "Verde", classe: "postit-verde", fundo: "#d9f3d5" },
        { nome: "Pêssego", classe: "postit-pessego", fundo: "#ffdfca" },
      ].map((cor) => ({
        ...cor,
        rotulo: "📝",
        classeBotao: "amostra-postit",
      }));

      abrirPainelMemoria(
        "Escolha seu post-it",
        "Selecione uma cor para adicionar uma nota à página.",
        cores,
        (cor) => {
          criarElementoMemoria("postit", "Escreva seu bilhete...", cor.classe);
        },
      );
    });

    const emojisDisponiveis = [
      "❤️", "💕", "💖", "💗", "💘", "💝", "💞", "💓", "✨", "🌟",
      "⭐", "🌸", "🌹", "🌷", "🌻", "🌼", "🥂", "💍", "💐", "🎂",
      "🎉", "🎊", "🦋", "🕊️", "😊", "🥰", "😍", "😘", "🤗", "😂",
      "🥹", "😎", "👰", "🤵", "👩‍❤️‍👨", "👨‍👩‍👧", "👨‍👩‍👦", "🏡", "🌈", "☀️",
      "🌙", "🌿", "🍀", "🌺", "📸", "🎵", "🎶", "💌", "🎁", "🧸",
      "🙏", "🤍", "🫶", "💫", "🔥", "👏", "🥳", "💃", "🕺", "🍾",
      "🌅", "📍", "🧡", "💛", "💚", "💙", "💜", "🩷", "🪻", "🪷",
      "🌱", "🍁", "🍂", "🌴", "🌊", "🐚", "🐾", "🐶", "🐱", "🕯️",
      "🎈", "🎀", "💎", "👑", "🧿", "🪄", "🪽", "🫧", "🪞", "🧵",
      "🪡",
    ];

    botaoEmoji.addEventListener("click", () => {
      const opcoes = emojisDisponiveis.map((emoji) => ({
        nome: emoji,
        rotulo: emoji,
        classeBotao: "amostra-emoji",
      }));

      abrirPainelMemoria(
        "Adesivos e emojis",
        "Escolha um elemento decorativo para adicionar à página.",
        opcoes,
        (opcao) => criarElementoMemoria("emoji-memoria", opcao.nome),
      );
    });

    botaoFita.addEventListener("click", () => {
      const fitas = [
        { nome: "Fita bege", fundo: "#e7c99acc" },
        { nome: "Fita rosa", fundo: "#f4b8cacc" },
        { nome: "Fita azul", fundo: "#a9d6e5cc" },
        { nome: "Fita lilás", fundo: "#d2b8eccc" },
        { nome: "Fita verde", fundo: "#b8d8b8cc" },
        { nome: "Fita kraft", fundo: "#c9a77dcc" },
      ].map((fita) => ({
        ...fita,
        rotulo: "▰",
        classeBotao: "amostra-postit",
      }));

      abrirPainelMemoria(
        "Escolha uma fita",
        "Adicione uma fita decorativa para prender fotos ou bilhetes.",
        fitas,
        (fita) => {
          criarElementoMemoria("fita-memoria", "", "", {
            corFita: fita.fundo,
            escala: 100,
          });
        },
      );
    });

    const paletaCores = document.createElement("div");
    paletaCores.className = "paleta-cores-memora";
    paletaCores.setAttribute("aria-label", "Cores do texto");

    const coresDisponiveis = [
      "#57351f",
      "#000000",
      "#FFFFFF",
      "#8B4513",
      "#B22222",
      "#D94F70",
      "#E91E63",
      "#9C27B0",
      "#673AB7",
      "#3F51B5",
      "#2196F3",
      "#008C95",
      "#2E7D32",
      "#689F38",
      "#F9A825",
      "#FF9800",
    ];

    coresDisponiveis.forEach((cor) => {
      const amostra = document.createElement("button");
      amostra.type = "button";
      amostra.title = `Usar cor ${cor}`;
      amostra.setAttribute("aria-label", `Usar cor ${cor}`);
      amostra.style.backgroundColor = cor;
      amostra.style.width = "24px";
      amostra.style.height = "24px";
      amostra.style.borderRadius = "50%";
      amostra.style.border = "1px solid #d4c1aa";
      amostra.style.cursor = "pointer";

      amostra.addEventListener("click", () => {
        corFonte.value = cor;
        atualizarElementoSelecionado();
      });

      paletaCores.appendChild(amostra);
    });

    formatacao.append(
      fonte,
      tamanhoFonte,
      paletaCores,
      alinhamento,
      document.createTextNode("Tamanho"),
      tamanhoElemento,
      document.createTextNode("Giro"),
      rotacaoElemento,
    );

    [
      fonte,
      tamanhoFonte,
      corFonte,
      alinhamento,
      tamanhoElemento,
      rotacaoElemento,
    ].forEach((controle) => {
      controle.addEventListener("input", atualizarElementoSelecionado);
    });

    for (const memoria of memorias) {
      renderizarElementoMemoria(memoria);
    }

    for (const foto of fotosDestaPagina) {
      const figura = document.createElement("figure");
      figura.style.position = "relative";
      figura.style.overflow = "hidden";

      const janelaFoto = document.createElement("div");
      janelaFoto.className = "foto-interna-janela";

      const camadaFoto = document.createElement("div");
      camadaFoto.style.width = "100%";
      camadaFoto.style.height = "100%";
      camadaFoto.className = "foto-interna-camada";

      const imagem = document.createElement("img");
      definirSrcOtimizado(imagem, foto, 1200);
      imagem.alt = "Fotografia do álbum";
      imagem.loading = "lazy";
      imagem.draggable = false;

      const chaveFoto = `${foto.name}`;

      const ajusteSalvo = ajustesFotosInternas.get(chaveFoto) || {
        x: 0,
        y: 0,
        zoom: 1,
      };

      const ajuste = { ...ajusteSalvo };

      function aplicarAjusteFoto() {
        camadaFoto.style.transform =
          `translate(-50%, -50%) ` +
          `translate(${ajuste.x}px, ${ajuste.y}px) ` +
          `scale(${ajuste.zoom})`;

        ajustesFotosInternas.set(chaveFoto, { ...ajuste });
      }

      camadaFoto.appendChild(imagem);
      janelaFoto.appendChild(camadaFoto);
      figura.appendChild(janelaFoto);

      let arrastandoFoto = false;
      let inicioX = 0;
      let inicioY = 0;
      let origemX = 0;
      let origemY = 0;

      janelaFoto.addEventListener("pointerdown", (evento) => {
        evento.preventDefault();
        janelaFoto.setPointerCapture(evento.pointerId);

        arrastandoFoto = true;
        inicioX = evento.clientX;
        inicioY = evento.clientY;
        origemX = ajuste.x;
        origemY = ajuste.y;

        janelaFoto.style.cursor = "grabbing";
      });

      janelaFoto.addEventListener("pointermove", (evento) => {
        if (!arrastandoFoto) return;

        ajuste.x = origemX + evento.clientX - inicioX;
        ajuste.y = origemY + evento.clientY - inicioY;

        aplicarAjusteFoto();
      });

      function finalizarArrasteFoto() {
        arrastandoFoto = false;
        janelaFoto.style.cursor = "grab";
      }

      janelaFoto.addEventListener("pointerup", finalizarArrasteFoto);
      janelaFoto.addEventListener("pointercancel", finalizarArrasteFoto);

      const controles = document.createElement("div");
      controles.className = "controles-zoom-foto";
      controles.style.zIndex = "5";

      const diminuir = document.createElement("button");
      diminuir.type = "button";
      diminuir.textContent = "−";
      diminuir.setAttribute("aria-label", "Diminuir zoom");

      const indicador = document.createElement("span");

      const aumentar = document.createElement("button");
      aumentar.type = "button";
      aumentar.textContent = "+";
      aumentar.setAttribute("aria-label", "Aumentar zoom");

      function atualizarZoomInterno(novoZoom) {
        ajuste.zoom = Math.max(0.5, Math.min(4, novoZoom));
        indicador.textContent = `${Math.round(ajuste.zoom * 100)}%`;
        aplicarAjusteFoto();
      }

      diminuir.addEventListener("click", () => {
        atualizarZoomInterno(ajuste.zoom - 0.1);
      });

      aumentar.addEventListener("click", () => {
        atualizarZoomInterno(ajuste.zoom + 0.1);
      });

      indicador.textContent = `${Math.round(ajuste.zoom * 100)}%`;
      const mover = document.createElement("button");
      mover.type = "button";
      mover.textContent = "✥";
      mover.title = "Arraste para mover esta foto pela página";
      mover.setAttribute("aria-label", "Mover foto pela página");
      mover.style.touchAction = "none";
      mover.style.cursor = "move";

      const trocar = document.createElement("button");
      trocar.type = "button";
      trocar.textContent = "⇄";
      trocar.title = "Trocar esta foto por outra do evento";
      trocar.setAttribute("aria-label", "Trocar foto");

      const posFoto = { ...(posicoesFotosPagina.get(foto.name) || { x: 0, y: 0 }) };

      function aplicarPosicaoFoto() {
        figura.style.translate = `${posFoto.x}cqw ${posFoto.y}cqw`;
        figura.style.zIndex = posFoto.x || posFoto.y ? "3" : "";
      }

      aplicarPosicaoFoto();

      mover.addEventListener("pointerdown", (evento) => {
        evento.preventDefault();
        evento.stopPropagation();

        try {
          mover.setPointerCapture(evento.pointerId);
        } catch (_) {}

        const larguraPagina =
          figura.closest(".album-pagina")?.clientWidth || 720;
        const ponteiroX0 = evento.clientX;
        const ponteiroY0 = evento.clientY;
        const baseX = posFoto.x;
        const baseY = posFoto.y;

        function arrastarFoto(ev) {
          posFoto.x = baseX + ((ev.clientX - ponteiroX0) / larguraPagina) * 100;
          posFoto.y = baseY + ((ev.clientY - ponteiroY0) / larguraPagina) * 100;

          aplicarPosicaoFoto();
          posicoesFotosPagina.set(foto.name, { ...posFoto });
        }

        function soltarFoto() {
          mover.removeEventListener("pointermove", arrastarFoto);
          mover.removeEventListener("pointerup", soltarFoto);
          mover.removeEventListener("pointercancel", soltarFoto);
        }

        mover.addEventListener("pointermove", arrastarFoto);
        mover.addEventListener("pointerup", soltarFoto);
        mover.addEventListener("pointercancel", soltarFoto);
      });

      trocar.addEventListener("click", () => {
        abrirSeletorFotoEvento({
          titulo: "Trocar esta foto por outra",
          nomeAtual: foto.name,
          aoEscolher: (nova) => trocarFotoNoAlbum(foto.name, nova.name),
        });
      });

      controles.append(diminuir, indicador, aumentar, mover, trocar);
      figura.appendChild(controles);

      const legenda = document.createElement("figcaption");
      legenda.textContent = "";
      figura.appendChild(legenda);

      aplicarAjusteFoto();
      grade.appendChild(figura);
    }

    // Controles ficam FORA da página: a página contém só o que faz parte dela
    const controlesPagina = document.createElement("div");
    controlesPagina.className = "controles-pagina-album";
    controlesPagina.append(seletorTipoPagina, seletorPagina);

    const blocoControles = document.createElement("div");
    blocoControles.className = "bloco-controles-pagina";
    blocoControles.append(controlesPagina, ferramentas, formatacao);

    pagina.append(tituloPagina, grade, camadaMemorias);

    previaAlbum.append(blocoControles, pagina);

    if (muralAdicionadoAoAlbum && posicaoMuralAposPaginaFoto === numeroPagina) {
      adicionarPaginasMuralNaPrevia();
    }

    indiceFoto += fotosDestaPagina.length;
    numeroPagina++;
  }

  previaAlbum.hidden = false;
  botaoVoltar.hidden = false;

  atualizarControlePosicaoMural(numeroPagina - 1);

  const paginasMural = muralAdicionadoAoAlbum
    ? Math.ceil(mensagensMuralAlbum.length / 15)
    : 0;

  mensagemFinal.textContent = muralAdicionadoAoAlbum
    ? `Pré-visualização criada com ${selecionadas.size} fotografia(s) e ${paginasMural} página(s) de mural.`
    : `Pré-visualização criada com ${selecionadas.size} fotografia(s). Você pode inserir o mural usando os controles da etapa 04.`;
}

function atualizarPreviaExistente() {
  renderizarCapa();

  if (!previaAlbum.hidden) {
    montarPreviaAlbum();
  }
}

botaoVisualizar.addEventListener("click", () => {
  if (selecionadas.size === 0) {
    mensagemFinal.textContent =
      "Selecione pelo menos uma fotografia para visualizar o álbum.";
    return;
  }

  montarPreviaAlbum();

  requestAnimationFrame(() => {
    botaoFolhearAlbum?.click();
  });
});

botaoVoltar.addEventListener("click", () => {
  previaAlbum.hidden = true;
  botaoVoltar.hidden = true;

  mensagemFinal.textContent =
    "Você voltou à edição. Suas seleções continuam preservadas.";

  document.getElementById("selecao").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

let temporizadorPrevia = null;

function atualizarPreviaComAtraso() {
  clearTimeout(temporizadorPrevia);
  temporizadorPrevia = setTimeout(atualizarPreviaExistente, 300);
}

["titulo", "nomes", "dataEvento", "fraseCapa", "corTexto"].forEach((id) => {
  const campo = document.getElementById(id);
  if (!campo) return;

  campo.addEventListener("input", atualizarPreviaComAtraso);
  campo.addEventListener("change", atualizarPreviaExistente);
});

document.querySelectorAll(".modelo-capa").forEach((botao) => {
  botao.addEventListener("click", () => {
    const modelo = botao.dataset.modelo;
    if (!fundosCapa[modelo]) return;

    modeloCapa = modelo;

    document.querySelectorAll(".modelo-capa").forEach((item) => {
      const ativo = item === botao;
      item.classList.toggle("ativo", ativo);
      item.setAttribute("aria-pressed", String(ativo));
    });

    atualizarPreviaExistente();
  });
});

document.getElementById("restaurarFoto")?.addEventListener("click", () => {
  ajusteFotoCapa = { x: 0, y: 0, zoom: 1, rotacao: 0 };
  renderizarCapa();
});

/* =========================================================
   CONTROLES PARA INSERIR OU REMOVER O MURAL
========================================================= */

if (seletorPosicaoMural) {
  seletorPosicaoMural.addEventListener("change", () => {
    posicaoMuralAposPaginaFoto = Number(seletorPosicaoMural.value) || 0;

    if (!previaAlbum.hidden) {
      montarPreviaAlbum();
    }
  });
}

if (botaoAdicionarMural) {
  botaoAdicionarMural.addEventListener("click", () => {
    if (!previaAlbum || previaAlbum.hidden) {
      if (statusMuralAlbum) {
        statusMuralAlbum.textContent =
          "Clique em Visualizar álbum primeiro. Depois escolha onde inserir o mural.";
      }
      return;
    }

    if (!mensagensMuralAlbum.length) {
      if (statusMuralAlbum) {
        statusMuralAlbum.textContent =
          "Não há mensagens publicadas disponíveis para inserir neste álbum.";
      }
      return;
    }

    posicaoMuralAposPaginaFoto = Number(seletorPosicaoMural?.value) || 0;

    muralAdicionadoAoAlbum = true;
    montarPreviaAlbum();

    if (statusMuralAlbum) {
      statusMuralAlbum.textContent =
        "Mural inserido na sequência do álbum. Se houver mais de 15 mensagens, serão criadas páginas consecutivas adicionais.";
    }
  });
}

if (botaoRemoverMural) {
  botaoRemoverMural.addEventListener("click", () => {
    muralAdicionadoAoAlbum = false;
    montarPreviaAlbum();

    if (statusMuralAlbum) {
      statusMuralAlbum.textContent =
        "Mural removido da pré-visualização do álbum.";
    }
  });
}

const botaoEscolherFotoCapa = document.getElementById("escolherFotoCapa");

const botaoRemoverFotoCapa = document.getElementById("removerFotoCapa");

botaoEscolherFotoCapa?.addEventListener("click", () => {
  const modal = document.createElement("div");
  modal.className = "modal-fotos-capa";

  const painel = document.createElement("section");
  painel.className = "painel-fotos-capa";
  painel.setAttribute("role", "dialog");
  painel.setAttribute("aria-modal", "true");
  painel.setAttribute("aria-label", "Escolher foto da capa");

  const cabecalho = document.createElement("div");
  cabecalho.className = "cabecalho-fotos-capa";

  const titulo = document.createElement("h3");
  titulo.textContent = "Escolher foto da capa";

  const fechar = document.createElement("button");
  fechar.type = "button";
  fechar.className = "botao botao-secundario";
  fechar.textContent = "Fechar";
  fechar.addEventListener("click", () => modal.remove());

  cabecalho.append(titulo, fechar);

  const grade = document.createElement("div");
  grade.className = "grade-fotos-capa";

  fotos.forEach((foto) => {
    const opcao = document.createElement("button");
    opcao.type = "button";
    opcao.className = "opcao-foto-capa";
    opcao.setAttribute("aria-label", `Usar ${foto.name} na capa`);

    const imagem = document.createElement("img");
    definirSrcOtimizado(imagem, foto, 300);
    imagem.alt = foto.name;
    imagem.loading = "lazy";

    opcao.appendChild(imagem);

    opcao.addEventListener("click", () => {
      fotoCapa = foto.name;
      usarFotoNaCapa = true;
      ajusteFotoCapa = { x: 0, y: 0, zoom: 1, rotacao: 0 };
      chaveAjusteFoto = "";

      modal.remove();
      atualizarControlesFotos();
      renderizarCapa();
    });

    grade.appendChild(opcao);
  });

  painel.append(cabecalho, grade);
  modal.appendChild(painel);

  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
});

botaoRemoverFotoCapa?.addEventListener("click", () => {
  usarFotoNaCapa = false;
  fotoCapa = null;
  ajusteFotoCapa = { x: 0, y: 0, zoom: 1, rotacao: 0 };
  chaveAjusteFoto = "";

  atualizarControlesFotos();
  renderizarCapa();
});

/* =========================================================
   LEITOR INTERATIVO — FOLHEAR O ÁLBUM
========================================================= */

const botaoFolhearAlbum = document.getElementById("folhearAlbum");

function habilitarFolhearAlbum() {
  if (!previaAlbum.hidden && botaoFolhearAlbum) {
    botaoFolhearAlbum.hidden = false;

    botaoFolhearAlbum.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  } else {
    console.warn(
      "Memora: a pré-visualização ainda está oculta.",
      previaAlbum.hidden,
    );
  }
}

document.getElementById("visualizarAlbum")?.addEventListener("click", () => {
  setTimeout(habilitarFolhearAlbum, 0);
});

document
  .getElementById("visualizarAlbumLateral")
  ?.addEventListener("click", () => {
    if (selecionadas.size === 0) {
      mensagemFinal.textContent =
        "Selecione pelo menos uma fotografia na galeria para editar as páginas.";

      document.getElementById("selecao")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    // Monta a área de edição apenas se ela ainda não estiver aberta
    if (previaAlbum.hidden) {
      montarPreviaAlbum();
    }

    if (botaoFolhearAlbum) {
      botaoFolhearAlbum.hidden = false;
    }

    requestAnimationFrame(() => {
      previaAlbum.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

botaoFolhearAlbum?.addEventListener("click", () => {
  const paginas = [
    ...document.querySelectorAll(
      "#previaAlbum > .capa-preview, #previaAlbum > .album-pagina",
    ),
  ];

  if (paginas.length === 0) {
    mensagemFinal.textContent =
      "Primeiro visualize o álbum para poder folheá-lo.";
    return;
  }

  let indice = 0;

  const leitor = document.createElement("div");
  leitor.className = "leitor-livro-memora";
  leitor.setAttribute("role", "dialog");
  leitor.setAttribute("aria-modal", "true");
  leitor.setAttribute("aria-label", "Álbum digital");

  const livro = document.createElement("div");
  livro.className = "livro-memora";

  const barra = document.createElement("div");
  barra.className = "barra-leitor-memora";

  const contador = document.createElement("span");
  contador.className = "contador-leitor-memora";

  const fechar = document.createElement("button");
  fechar.type = "button";
  fechar.className = "botao botao-secundario";
  fechar.textContent = "Fechar livro";
  fechar.addEventListener("click", () => leitor.remove());

  barra.append(contador, fechar);

  const paginasAbertas = document.createElement("div");
  paginasAbertas.className = "paginas-abertas-memora";

  const esquerda = document.createElement("div");
  esquerda.className = "folha-memora folha-esquerda";

  const direita = document.createElement("div");
  direita.className = "folha-memora folha-direita";

  paginasAbertas.append(esquerda, direita);

  const navegacao = document.createElement("div");
  navegacao.className = "navegacao-livro-memora";

  const anterior = document.createElement("button");
  anterior.type = "button";
  anterior.className = "botao botao-secundario";
  anterior.textContent = "← Anterior";

  const proxima = document.createElement("button");
  proxima.type = "button";
  proxima.className = "botao";
  proxima.textContent = "Próxima →";

  navegacao.append(anterior, proxima);
  livro.append(barra, paginasAbertas, navegacao);
  leitor.appendChild(livro);

  // A página é copiada no tamanho ORIGINAL da edição e depois reduzida
  // com scale() para caber na folha. Assim nada muda de posição.
  function clonarPaginaParaLeitor(paginaOriginal) {
    const largura = paginaOriginal.offsetWidth;
    const altura = paginaOriginal.offsetHeight;

    const copia = paginaOriginal.cloneNode(true);

    copia.querySelectorAll(".selecionado").forEach((el) => {
      el.classList.remove("selecionado");
    });

    copia.querySelectorAll("[contenteditable]").forEach((el) => {
      el.removeAttribute("contenteditable");
    });

    copia
      .querySelectorAll("select, .controles-zoom-foto, .botao-excluir-memoria")
      .forEach((el) => el.remove());

    Object.assign(copia.style, {
      width: `${largura}px`,
      height: `${altura}px`,
      minHeight: "0",
      maxHeight: "none",
      aspectRatio: "auto",
      margin: "0",
    });

    const moldura = document.createElement("div");
    moldura.className = "pagina-escalada";
    moldura.dataset.largura = String(largura);
    moldura.dataset.altura = String(altura);
    moldura.appendChild(copia);

    return moldura;
  }

  function ajustarEscalaFolhas() {
    [esquerda, direita].forEach((folha) => {
      const moldura = folha.querySelector(".pagina-escalada");
      if (!moldura) return;

      const largura = Number(moldura.dataset.largura);
      const altura = Number(moldura.dataset.altura);
      if (!largura || !altura) return;

      const escala = Math.min(
        folha.clientWidth / largura,
        folha.clientHeight / altura,
      );

      moldura.style.width = `${largura * escala}px`;
      moldura.style.height = `${altura * escala}px`;

      const paginaCopiada = moldura.firstElementChild;
      paginaCopiada.style.transformOrigin = "top left";
      paginaCopiada.style.transform = `scale(${escala})`;
    });
  }

  const modoUnico = () => window.matchMedia("(max-width: 700px)").matches;

  function mostrarPagina(destino) {
    indice = destino;
    esquerda.replaceChildren();
    direita.replaceChildren();

    // Celular: mostra uma página por vez (a folha esquerda fica oculta)
    if (modoUnico()) {
      esquerda.style.background = "";
      esquerda.style.backgroundColor = "";
      direita.classList.remove("folha-vazia");

      direita.appendChild(clonarPaginaParaLeitor(paginas[indice]));
      direita.style.backgroundColor =
        getComputedStyle(paginas[indice]).backgroundColor;

      contador.textContent = `Página ${indice + 1} de ${paginas.length}`;
      anterior.disabled = indice === 0;
      proxima.disabled = indice >= paginas.length - 1;

      ajustarEscalaFolhas();
      return;
    }

    if (indice === 0) {
      direita.appendChild(clonarPaginaParaLeitor(paginas[0]));
      esquerda.classList.add("folha-vazia");
      direita.classList.remove("folha-vazia");
    } else {
      esquerda.classList.remove("folha-vazia");
      direita.classList.remove("folha-vazia");

      if (paginas[indice]) {
        esquerda.appendChild(clonarPaginaParaLeitor(paginas[indice]));
      } else {
        esquerda.classList.add("folha-vazia");
      }

      if (paginas[indice + 1]) {
        direita.appendChild(clonarPaginaParaLeitor(paginas[indice + 1]));
      } else {
        direita.classList.add("folha-vazia");
      }
    }

    // Cor de fundo de cada folha acompanha a página que está nela
    esquerda.style.background = "";
    esquerda.style.backgroundColor = "";
    direita.style.backgroundColor = "";

    if (indice === 0 && paginas[0].classList.contains("capa-mural-preview")) {
      esquerda.style.background = "linear-gradient(90deg, #120b07, #2b1b11)";
    }

    const paginaEsq = indice === 0 ? null : paginas[indice];
    const paginaDir = indice === 0 ? paginas[0] : paginas[indice + 1];

    if (paginaEsq) {
      esquerda.style.backgroundColor =
        getComputedStyle(paginaEsq).backgroundColor;
    }

    if (paginaDir) {
      direita.style.backgroundColor =
        getComputedStyle(paginaDir).backgroundColor;
    }

    contador.textContent =
      indice === 0
        ? `Capa · ${paginas.length} página(s) no total`
        : `Páginas ${indice + 1}${paginas[indice + 1] ? `–${indice + 2}` : ""} de ${paginas.length}`;

    anterior.disabled = indice === 0;
    proxima.disabled =
      indice === 0 ? paginas.length <= 1 : indice + 2 >= paginas.length;

    ajustarEscalaFolhas();
  }

  anterior.addEventListener("click", () => {
    if (modoUnico()) {
      mostrarPagina(Math.max(0, indice - 1));
      return;
    }

    if (indice === 1) {
      mostrarPagina(0);
    } else if (indice > 1) {
      mostrarPagina(indice - 2);
    }
  });

  proxima.addEventListener("click", () => {
    if (modoUnico()) {
      mostrarPagina(Math.min(paginas.length - 1, indice + 1));
      return;
    }

    if (indice === 0) {
      mostrarPagina(1);
    } else if (indice + 2 < paginas.length) {
      mostrarPagina(indice + 2);
    }
  });

  leitor.addEventListener("click", (evento) => {
    if (evento.target === leitor) leitor.remove();
  });

  const estilo = document.createElement("style");
  estilo.textContent = `
    .leitor-livro-memora {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(25, 15, 10, .92);
    }

    .livro-memora {
      width: min(1200px, 100%);
      height: min(95vh, 1000px);
      display: flex;
      flex-direction: column;
      gap: 14px;
      color: #fff8ef;
    }

    .barra-leitor-memora,
    .navegacao-livro-memora {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .paginas-abertas-memora {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 3px;
      perspective: 1800px;
    }

    .folha-memora {
      position: relative;
      box-sizing: border-box;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fffaf2;
      box-shadow: 0 8px 30px #0005;
      transform-origin: left center;
      animation: entrada-folha-memora .35s ease both;
    }

    .folha-esquerda { border-radius: 8px 0 0 8px; }
    .folha-direita { border-radius: 0 8px 8px 0; }
    .folha-vazia { background: linear-gradient(90deg, #eadbc7, #fffaf2); }

    .pagina-escalada {
      position: relative;
      flex: none;
      overflow: hidden;
      pointer-events: none;
      user-select: none;
    }

    .pagina-escalada > * {
      position: absolute !important;
      top: 0;
      left: 0;
      margin: 0 !important;
    }

    .pagina-escalada .controles-pagina-album,
    .pagina-escalada .botao-excluir-memoria,
    .pagina-escalada .controles-zoom-foto {
      display: none !important;
    }

    .pagina-escalada .item-memoria {
      resize: none !important;
    }

    .pagina-escalada .item-memoria.postit {
      overflow: hidden;
    }

    @keyframes entrada-folha-memora {
      from { opacity: .45; transform: rotateY(-5deg); }
      to { opacity: 1; transform: rotateY(0); }
    }

    @media (max-width: 700px) {
      .paginas-abertas-memora { grid-template-columns: minmax(0, 1fr); }
      .folha-esquerda { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .folha-memora { animation: none; }
    }
  `;

  // Moldura dourada: aplicada DEPOIS do CSS base para não ser sobrescrita
  const estiloMoldura = document.createElement("style");
  estiloMoldura.textContent = `
    .paginas-abertas-memora {
      box-sizing: border-box;
      padding: 7px;
      border-radius: 12px;
      background: linear-gradient(
        135deg,
        #f3d99b 0%,
        #c9954b 28%,
        #8a5a22 50%,
        #e4c783 75%,
        #b9853e 100%
      );
      box-shadow:
        0 0 0 1px #5a3a14,
        0 12px 40px rgba(0, 0, 0, 0.55),
        inset 0 0 0 1px rgba(255, 244, 214, 0.55);
    }

    .folha-esquerda { border-radius: 6px 0 0 6px; }
    .folha-direita { border-radius: 0 6px 6px 0; }

    .pagina-escalada > * {
      border-radius: 0 !important;
    }

    .pagina-escalada > .pagina-mural-album,
    .pagina-escalada > .capa-preview {
      border: 0 !important;
    }
  `;

  leitor.appendChild(estilo);
  leitor.appendChild(estiloMoldura);
  document.body.appendChild(leitor);
  mostrarPagina(0);

  new ResizeObserver(ajustarEscalaFolhas).observe(paginasAbertas);
});

/* =========================================================
   AVISO: EDITOR ABERTO SEM O ID DO EVENTO
========================================================= */

if (!EVENTO_ID) {
  const aviso = document.createElement("div");
  aviso.textContent =
    "⚠ O mural não carregou: abra o editor com ?eventoId=... na URL (pelo Dashboard).";

  Object.assign(aviso.style, {
    position: "sticky",
    top: "0",
    zIndex: "99999",
    padding: "10px 16px",
    background: "#b3261e",
    color: "#fff",
    font: "bold 14px Arial, sans-serif",
    textAlign: "center",
  });

  document.body.prepend(aviso);
}

/* =========================================================
   SALVAMENTO DO ÁLBUM (Supabase · tabela album_rascunhos)
========================================================= */

const botaoSalvarAlbum = document.getElementById("salvarRascunhoLateral");
const statusSalvamento = document.getElementById("statusSalvamento");

const CAMPOS_TEXTO_ALBUM = ["titulo", "nomes", "dataEvento", "fraseCapa", "corTexto"];
const INTERVALO_AUTOSAVE_MS = 20000;

let usuarioAtual = null;
let salvandoAlbum = false;
let ultimoSnapshotSalvo = "";
let rascunhoPronto = false; // só permite salvar depois de ler o rascunho existente

function mostrarStatusSalvamento(texto, erro = false) {
  [statusSalvamento, document.getElementById("statusSalvamentoFinal")].forEach(
    (alvo) => {
      if (!alvo) return;

      alvo.textContent = texto;
      alvo.style.color = erro ? "#b3261e" : "";
    },
  );
}

async function garantirUsuario() {
  if (usuarioAtual) return usuarioAtual;

  const { data } = await supabaseClient.auth.getSession();
  usuarioAtual = data?.session?.user || null;

  return usuarioAtual;
}

/* Reúne tudo o que o usuário construiu em um único objeto. */
function coletarEstadoAlbum() {
  const campos = {};

  CAMPOS_TEXTO_ALBUM.forEach((id) => {
    campos[id] = document.getElementById(id)?.value ?? "";
  });

  const memorias = {};

  elementosMemoriaPaginas.forEach((lista, chave) => {
    memorias[chave] = lista.map((item) => ({ ...item }));
  });

  return {
    versao: 1,
    campos,
    modeloCapa,
    fotoCapa,
    usarFotoNaCapa,
    ajusteFotoCapa: { ...ajusteFotoCapa },
    posicoesTextosCapa: Object.fromEntries(posicoesTextosCapa),
    selecionadas: [...selecionadas],
    layoutPadraoAlbum,
    layoutsPaginas: Object.fromEntries(layoutsPaginas),
    tiposPaginas: Object.fromEntries(tiposPaginas),
    ajustesFotosInternas: Object.fromEntries(ajustesFotosInternas),
    ordemAlbum: [...ordemAlbum],
    posicoesFotos: Object.fromEntries(posicoesFotosPagina),
    memorias,
    muralAdicionadoAoAlbum,
    posicaoMuralAposPaginaFoto,
  };
}

/* Devolve ao editor o que foi salvo. */
function aplicarEstadoAlbum(dados) {
  CAMPOS_TEXTO_ALBUM.forEach((id) => {
    const campo = document.getElementById(id);

    if (campo && dados.campos && dados.campos[id] !== undefined) {
      campo.value = dados.campos[id];
    }
  });

  if (dados.modeloCapa && fundosCapa[dados.modeloCapa]) {
    modeloCapa = dados.modeloCapa;
  }

  fotoCapa = dados.fotoCapa || null;
  usarFotoNaCapa = Boolean(dados.usarFotoNaCapa && fotoCapa);

  ajusteFotoCapa = {
    x: 0,
    y: 0,
    zoom: 1,
    rotacao: 0,
    ...(dados.ajusteFotoCapa || {}),
  };

  // Evita que o enquadramento salvo seja zerado na primeira renderização
  chaveAjusteFoto = usarFotoNaCapa ? `${modeloCapa}:${fotoCapa}` : "";

  posicoesTextosCapa.clear();
  Object.entries(dados.posicoesTextosCapa || {}).forEach(([chave, valor]) => {
    posicoesTextosCapa.set(chave, valor);
  });

  selecionadas.clear();
  (dados.selecionadas || []).forEach((nome) => selecionadas.add(nome));

  layoutPadraoAlbum = dados.layoutPadraoAlbum || "elegante";

  const seletorPadrao = document.getElementById("layoutPadrao");
  if (seletorPadrao) seletorPadrao.value = layoutPadraoAlbum;

  layoutsPaginas.clear();
  Object.entries(dados.layoutsPaginas || {}).forEach(([chave, valor]) => {
    layoutsPaginas.set(chave, valor);
  });

  tiposPaginas.clear();
  Object.entries(dados.tiposPaginas || {}).forEach(([chave, valor]) => {
    tiposPaginas.set(chave, valor);
  });

  ajustesFotosInternas.clear();
  Object.entries(dados.ajustesFotosInternas || {}).forEach(([chave, valor]) => {
    ajustesFotosInternas.set(chave, valor);
  });

  ordemAlbum = Array.isArray(dados.ordemAlbum) ? [...dados.ordemAlbum] : [];

  posicoesFotosPagina.clear();
  Object.entries(dados.posicoesFotos || {}).forEach(([chave, valor]) => {
    posicoesFotosPagina.set(chave, valor);
  });

  elementosMemoriaPaginas.clear();
  Object.entries(dados.memorias || {}).forEach(([chave, lista]) => {
    elementosMemoriaPaginas.set(chave, Array.isArray(lista) ? lista : []);
  });

  muralAdicionadoAoAlbum = Boolean(dados.muralAdicionadoAoAlbum);
  posicaoMuralAposPaginaFoto = Number(dados.posicaoMuralAposPaginaFoto) || 0;

  document.querySelectorAll(".modelo-capa").forEach((item) => {
    const ativo = item.dataset.modelo === modeloCapa;
    item.classList.toggle("ativo", ativo);
    item.setAttribute("aria-pressed", String(ativo));
  });
}

async function carregarRascunhoAlbum() {
  if (!EVENTO_ID) {
    mostrarStatusSalvamento(
      "Abra o editor pelo Dashboard para poder salvar o álbum.",
      true,
    );
    return;
  }

  const usuario = await garantirUsuario();

  if (!usuario) {
    mostrarStatusSalvamento(
      "Entre na sua conta para salvar e recuperar o álbum.",
      true,
    );
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("album_rascunhos")
      .select("dados, atualizado_em")
      .eq("evento_id", EVENTO_ID)
      .maybeSingle();

    if (error) throw error;

    if (data?.dados) {
      aplicarEstadoAlbum(data.dados);

      const quando = new Date(data.atualizado_em).toLocaleString("pt-BR");
      mostrarStatusSalvamento(`Álbum recuperado (salvo em ${quando}).`);
    } else {
      mostrarStatusSalvamento("Nenhum rascunho salvo ainda para este evento.");
    }

    ultimoSnapshotSalvo = JSON.stringify(coletarEstadoAlbum());
    rascunhoPronto = true;
  } catch (erro) {
    console.error("Erro ao carregar o rascunho do álbum:", erro);

    mostrarStatusSalvamento(
      "Não foi possível acessar o rascunho. Confira se a tabela album_rascunhos foi criada no Supabase.",
      true,
    );
  }
}

async function salvarAlbum({ silencioso = false } = {}) {
  if (salvandoAlbum) return false;

  if (!rascunhoPronto) {
    if (!silencioso) {
      mostrarStatusSalvamento(
        "O rascunho ainda não foi carregado. Recarregue a página e tente de novo.",
        true,
      );
    }
    return false;
  }

  const snapshot = JSON.stringify(coletarEstadoAlbum());

  if (silencioso && snapshot === ultimoSnapshotSalvo) return true;

  const usuario = await garantirUsuario();

  if (!usuario) {
    if (!silencioso) {
      mostrarStatusSalvamento("Entre na sua conta para salvar o álbum.", true);
    }
    return false;
  }

  salvandoAlbum = true;

  if (botaoSalvarAlbum) botaoSalvarAlbum.disabled = true;
  if (!silencioso) mostrarStatusSalvamento("Salvando o álbum...");

  try {
    const { error } = await supabaseClient.from("album_rascunhos").upsert(
      {
        evento_id: EVENTO_ID,
        owner_id: usuario.id,
        dados: JSON.parse(snapshot),
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "evento_id" },
    );

    if (error) throw error;

    ultimoSnapshotSalvo = snapshot;

    mostrarStatusSalvamento(
      `${silencioso ? "Salvo automaticamente" : "Álbum salvo"} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
    );

    return true;
  } catch (erro) {
    console.error("Erro ao salvar o álbum:", erro);

    mostrarStatusSalvamento(
      "Não foi possível salvar. Confira a conexão e as permissões do Supabase.",
      true,
    );

    return false;
  } finally {
    salvandoAlbum = false;
    if (botaoSalvarAlbum) botaoSalvarAlbum.disabled = false;
  }
}

function iniciarSalvamentoAutomatico() {
  botaoSalvarAlbum?.addEventListener("click", () => salvarAlbum());

  // Salva sozinho a cada 20 s, mas só se algo mudou
  setInterval(() => {
    if (!document.hidden) salvarAlbum({ silencioso: true });
  }, INTERVALO_AUTOSAVE_MS);

  // Ao trocar de aba ou minimizar, salva na hora
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) salvarAlbum({ silencioso: true });
  });
}

/* =========================================================
   INÍCIO DO EDITOR
========================================================= */

document
  .getElementById("voltarEdicaoLateral")
  ?.addEventListener("click", () => {
    salvarAlbum({ silencioso: true });
    botaoVoltar.click();
  });

/* =========================================================
   CELULAR: COMANDOS FINAIS DEPOIS DAS PÁGINAS
========================================================= */

function prepararAcoesFinaisMobile() {
  const previa = document.getElementById("previaAlbum");

  if (!previa || document.getElementById("acoesFinaisAlbum")) return;

  const estiloFinal = document.createElement("style");
  estiloFinal.textContent = `
    .acoes-finais-album { display: none; }

    @media (max-width: 760px) {
      .acoes-finais-album {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 16px;
        border: 1px solid #dfc7ac;
        border-radius: 12px;
        background: #fffaf4;
        box-shadow: 0 4px 14px #00000010;
      }

      #previaAlbum[hidden] + .acoes-finais-album { display: none; }

      .acoes-finais-album h3 {
        margin: 0 0 2px;
        color: #57351f;
        font: 15px Georgia, serif;
      }

      .acoes-finais-album .botao { width: 100%; }

      /* o que fica só na barra lateral do computador */
      .so-desktop { display: none !important; }
      .acoes-topo-album { display: none !important; }
    }
  `;
  document.head.appendChild(estiloFinal);

  ["salvarRascunhoLateral", "voltarEdicaoLateral", "compartilharAlbum", "statusSalvamento"].forEach(
    (id) => document.getElementById(id)?.classList.add("so-desktop"),
  );

  document.querySelectorAll(".painel-lateral-album h3").forEach((titulo) => {
    if (titulo.textContent.trim() === "Comandos") {
      titulo.classList.add("so-desktop");
    }
  });

  document
    .getElementById("visualizarAlbum")
    ?.closest(".acoes")
    ?.classList.add("acoes-topo-album");

  const barra = document.createElement("section");
  barra.id = "acoesFinaisAlbum";
  barra.className = "acoes-finais-album";
  barra.setAttribute("aria-label", "Comandos finais do álbum");

  const titulo = document.createElement("h3");
  titulo.textContent = "Terminou? Confira e guarde seu álbum";

  const visualizar = document.createElement("button");
  visualizar.type = "button";
  visualizar.className = "botao";
  visualizar.textContent = "📖 Visualizar álbum";
  visualizar.addEventListener("click", () => botaoVisualizar.click());

  const salvar = document.createElement("button");
  salvar.type = "button";
  salvar.id = "salvarAlbumFinal";
  salvar.className = "botao";
  salvar.textContent = "💾 Salvar álbum";
  salvar.addEventListener("click", () => salvarAlbum());

  const voltar = document.createElement("button");
  voltar.type = "button";
  voltar.className = "botao botao-secundario";
  voltar.textContent = "Voltar à edição";
  voltar.addEventListener("click", () => {
    salvarAlbum({ silencioso: true });
    botaoVoltar.click();
  });

  const status = document.createElement("p");
  status.id = "statusSalvamentoFinal";
  status.className = "descricao";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.style.margin = "0";

  barra.append(titulo, visualizar, salvar, voltar, status);
  previa.after(barra);
}

prepararAcoesFinaisMobile();

async function iniciarEditor() {
  // 1) recupera o que foi salvo; 2) só então carrega mural e fotos
  await carregarRascunhoAlbum();

  carregarMensagensMuralAlbum();
  carregarFotos();

  iniciarSalvamentoAutomatico();
}

iniciarEditor();