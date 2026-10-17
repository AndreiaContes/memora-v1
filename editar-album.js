const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = "fotos-eventos";
const EVENTO = new URLSearchParams(location.search).get("evento") || "default";
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
const botaoPdf = document.getElementById("baixarPdf");
const previaCapa = document.getElementById("previaCapa");
const previaAlbum = document.getElementById("previaAlbum");
const mensagemFinal = document.getElementById("mensagemFinal");
const ajustesFotosCapa = new Map();
const posicoesTextosCapa = new Map();
const layoutsPaginas = new Map();
const ajustesFotosInternas = new Map();
const elementosMemoriaPaginas = new Map();

let layoutPadraoAlbum = "elegante";
let fotos = [];
let paginaAtual = 0;
let fotoCapa = null;
let usarFotoNaCapa = false;
let chaveAjusteFoto = "";
let modeloCapa = "classico";
let ajusteFotoCapa = { x: 0, y: 0, zoom: 1, rotacao: 0 };

const selecionadas = new Set();
const urlsFotos = new Map();

const chaveRascunho = `memora-rascunho-${EVENTO}`;

function salvarRascunho() {
  const rascunho = {
    titulo: document.getElementById("titulo").value,
    nomes: document.getElementById("nomes").value,
    dataEvento: document.getElementById("dataEvento").value,
    fraseCapa: document.getElementById("fraseCapa").value,
    corTexto: document.getElementById("corTexto").value,
    selecionadas: [...selecionadas],
    fotoCapa,
    usarFotoNaCapa,
    modeloCapa,
    layoutPadraoAlbum,
    posicoesTextosCapa: [...posicoesTextosCapa.entries()],
    layoutsPaginas: [...layoutsPaginas.entries()],
    ajustesFotosCapa: [...ajustesFotosCapa.entries()],
    ajustesFotosInternas: [...ajustesFotosInternas.entries()],
    elementosMemoriaPaginas: [...elementosMemoriaPaginas.entries()],
    salvoEm: new Date().toISOString(),
  };

  try {
    localStorage.setItem(chaveRascunho, JSON.stringify(rascunho));

    const statusSalvamento = document.getElementById("statusSalvamento");
    if (statusSalvamento) {
      statusSalvamento.textContent = `Rascunho salvo neste navegador às ${new Date().toLocaleTimeString(
        "pt-BR",
        {
          hour: "2-digit",
          minute: "2-digit",
        },
      )}.`;
    }
  } catch (erro) {
    console.error("Erro ao salvar o rascunho:", erro);

    const statusSalvamento = document.getElementById("statusSalvamento");
    if (statusSalvamento) {
      statusSalvamento.textContent =
        "Não foi possível salvar o rascunho neste navegador.";
    }
  }
}

function restaurarRascunho() {
  try {
    const textoSalvo = localStorage.getItem(chaveRascunho);
    if (!textoSalvo) return;

    const rascunho = JSON.parse(textoSalvo);

    document.getElementById("titulo").value = rascunho.titulo || "";
    document.getElementById("nomes").value = rascunho.nomes || "";
    document.getElementById("dataEvento").value = rascunho.dataEvento || "";
    document.getElementById("fraseCapa").value = rascunho.fraseCapa || "";
    document.getElementById("corTexto").value = rascunho.corTexto || "auto";

    selecionadas.clear();
    (rascunho.selecionadas || []).forEach((nome) => {
      if (fotos.some((foto) => foto.name === nome)) {
        selecionadas.add(nome);
      }
    });

    fotoCapa = fotos.some((foto) => foto.name === rascunho.fotoCapa)
      ? rascunho.fotoCapa
      : null;

    usarFotoNaCapa = Boolean(fotoCapa && rascunho.usarFotoNaCapa);
    modeloCapa = fundosCapa[rascunho.modeloCapa]
      ? rascunho.modeloCapa
      : "classico";
    layoutPadraoAlbum = rascunho.layoutPadraoAlbum || "elegante";

    posicoesTextosCapa.clear();
    (rascunho.posicoesTextosCapa || []).forEach(([chave, valor]) => {
      posicoesTextosCapa.set(chave, valor);
    });

    layoutsPaginas.clear();
    (rascunho.layoutsPaginas || []).forEach(([chave, valor]) => {
      layoutsPaginas.set(chave, valor);
    });

    ajustesFotosCapa.clear();
    (rascunho.ajustesFotosCapa || []).forEach(([chave, valor]) => {
      ajustesFotosCapa.set(chave, valor);
    });

    ajustesFotosInternas.clear();
    (rascunho.ajustesFotosInternas || []).forEach(([chave, valor]) => {
      ajustesFotosInternas.set(chave, valor);
    });

    elementosMemoriaPaginas.clear();
    (rascunho.elementosMemoriaPaginas || []).forEach(([chave, valor]) => {
      elementosMemoriaPaginas.set(chave, valor);
    });

    document.querySelectorAll(".modelo-capa").forEach((botao) => {
      const ativo = botao.dataset.modelo === modeloCapa;
      botao.classList.toggle("ativo", ativo);
      botao.setAttribute("aria-pressed", String(ativo));
    });

    const seletorLayout = document.getElementById("layoutPadrao");
    if (seletorLayout) seletorLayout.value = layoutPadraoAlbum;

    atualizarQuantidade();
  } catch (erro) {
    console.error("Erro ao restaurar o rascunho:", erro);
  }
}
const fundosCapa = {
  classico: "img/capas/capa-classica.png",
  minimalista: "img/capas/capa-minimalista.png",
  florido: "img/capas/capa-florida.png",
  moderno: "img/capas/capa-moderna.png",
  fotografico: "img/capas/capa-fotografica.png",
  contemporaneo: "img/capas/capa-contemporanea.png",
};

const coresAutomaticas = {
  classico: "#57351f",
  minimalista: "#57351f",
  florido: "#8b4055",
  moderno: "#d8b15a",
  fotografico: "#57351f",
  contemporaneo: "#57351f",
};

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

    restaurarRascunho();
    renderizarPagina();
    renderizarCapa();
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
    imagem.src = obterUrl(foto);
    imagem.alt = "Fotografia do evento";
    imagem.loading = "lazy";

    // Controle independente: incluir nas páginas do álbum
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = foto.name;
    checkbox.checked = selecionadas.has(foto.name);

    const labelSelecao = document.createElement("label");
    labelSelecao.append(checkbox, document.createTextNode(" Incluir no álbum"));

    // Controle independente: usar na capa
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

      // Não altera a escolha da capa.
      atualizarQuantidade();
      atualizarPreviaExistente();
    });

    checkboxCapa.addEventListener("change", () => {
      if (checkboxCapa.checked) {
        usarFotoNaCapa = true;
        fotoCapa = foto.name;

        // Atualiza os controles de capa visíveis na página.
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
  if (!fotoCapa && fotos.length) fotoCapa = fotos[0].name;

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

  // Textos da capa
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
    // Área reservada para a foto em cada arte.
    // Valores em porcentagem relativos à capa.
    const molduras = {
      classico: {
        top: 47,
        left: 16,
        width: 68,
        height: 31,
        radius: "0",
      },
      minimalista: {
        top: 30,
        left: 12,
        width: 76,
        height: 23,
        radius: "0",
      },
      florido: {
        top: 27,
        left: 17,
        width: 66,
        height: 32,
        radius: "0",
      },
      moderno: {
        top: 22,
        left: 17,
        width: 66,
        height: 53,
        radius: "0",
      },
      fotografico: {
        top: 9,
        left: 10,
        width: 80,
        height: 43,
        radius: "0",
      },
      contemporaneo: {
        top: 35,
        left: 15,
        width: 70,
        height: 30,
        radius: "100px 100px 0 0",
      },
    };

    const moldura = molduras[modelo] || molduras.classico;

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
    // Camada independente que pode ser movida.
    camada = document.createElement("div");
    camada.className = "camada-foto";

    imagem = document.createElement("img");
    imagem.className = "foto-ajustavel";
    imagem.src = obterUrl(fotoEscolhida);
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

    // Gestos com mouse, toque, pinça e rotação.
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

  // Configura dimensões da camada após criar a moldura.
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

    if (imagem.complete && imagem.naturalWidth) {
      aplicarAjuste();
    } else {
      imagem.addEventListener("load", aplicarAjuste, { once: true });
    }
  }
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
  }

  const fotosSelecionadas = fotos.filter((foto) => selecionadas.has(foto.name));

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

    seletorPagina.addEventListener("change", () => {
      layoutsPaginas.set(chavePagina, seletorPagina.value);
      montarPreviaAlbum();
    });

    const tituloPagina = document.createElement("h3");
    const tituloAlbum = document.getElementById("titulo").value.trim();

    tituloPagina.textContent = tituloAlbum
      ? `${tituloAlbum} · Página ${numeroPagina}`
      : `Página ${numeroPagina}`;

    const grade = document.createElement("div");
    grade.className = "fotos-pagina";

    const estiloMemoriasId = "memora-estilos-memorias";

    if (!document.getElementById(estiloMemoriasId)) {
      const estilo = document.createElement("style");
      estilo.id = estiloMemoriasId;
      estilo.textContent = `
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
      document.head.appendChild(estilo);
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
      camadaMemorias
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
      if (!itemSelecionado) return;

      const memoria = memorias.find(
        (item) => item.id === itemSelecionado.dataset.id,
      );

      if (!memoria) return;

      memoria.fonte = fonte.value;
      memoria.tamanhoFonte = Number(tamanhoFonte.value) || 16;
      memoria.corFonte = corFonte.value;
      memoria.alinhamento = alinhamento.value;
      memoria.escala = Number(tamanhoElemento.value) || 100;
      memoria.rotacao = Number(rotacaoElemento.value) || 0;

      const conteudo = itemSelecionado.querySelector(".conteudo-memoria");

      if (conteudo) {
        conteudo.style.fontFamily = memoria.fonte;
        conteudo.style.fontSize = `${memoria.tamanhoFonte}px`;
        conteudo.style.color = memoria.corFonte;
        conteudo.style.textAlign = memoria.alinhamento;
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

      const grade = document.createElement("div");
      grade.className = "opcoes-memoria";

      opcoes.forEach((opcao) => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.textContent = opcao.rotulo;
        botao.title = opcao.nome;
        botao.className = opcao.classeBotao || "";

        if (opcao.fundo) botao.style.background = opcao.fundo;

        botao.addEventListener("click", () => {
          fundo.remove();
          aoEscolher(opcao);
        });

        grade.appendChild(botao);
      });

      const acoes = document.createElement("div");
      acoes.className = "acoes-painel-memoria";

      const cancelar = document.createElement("button");
      cancelar.type = "button";
      cancelar.textContent = "Cancelar";
      cancelar.addEventListener("click", () => fundo.remove());

      acoes.appendChild(cancelar);
      painel.append(cabecalho, texto, grade, acoes);
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
      const ehTextoEditavel = !ehEmoji && !ehFita;

      const conteudo = document.createElement("div");
      conteudo.className = "conteudo-memoria";

      if (ehEmoji || ehFita) {
        conteudo.textContent = memoria.conteudo;
      } else {
        conteudo.contentEditable = "true";
        conteudo.textContent = memoria.conteudo;
        conteudo.setAttribute("role", "textbox");
        conteudo.setAttribute("aria-label", "Editar texto da memória");
        conteudo.setAttribute("spellcheck", "true");

        conteudo.addEventListener("input", () => {
          memoria.conteudo = conteudo.textContent;
        });
      }

      item.appendChild(conteudo);

      // Botão para excluir o elemento selecionado.
      const botaoExcluir = document.createElement("button");
      botaoExcluir.type = "button";
      botaoExcluir.className = "excluir-elemento-memoria";
      botaoExcluir.textContent = "×";
      botaoExcluir.title = "Excluir elemento";
      botaoExcluir.setAttribute("aria-label", "Excluir elemento");

      Object.assign(botaoExcluir.style, {
        position: "absolute",
        top: "-12px",
        right: "-12px",
        width: "26px",
        height: "26px",
        borderRadius: "50%",
        border: "1px solid #b9853e",
        background: "#fffaf2",
        color: "#8b2e2e",
        fontSize: "20px",
        lineHeight: "20px",
        cursor: "pointer",
        zIndex: "20",
        display: "none",
      });

      botaoExcluir.addEventListener("pointerdown", (evento) => {
        evento.stopPropagation();
      });

      botaoExcluir.addEventListener("click", (evento) => {
        evento.preventDefault();
        evento.stopPropagation();

        const indice = memorias.findIndex(
          (elemento) => elemento.id === memoria.id,
        );

        if (indice !== -1) memorias.splice(indice, 1);

        item.remove();

        if (
          typeof itemSelecionado !== "undefined" &&
          itemSelecionado === item
        ) {
          itemSelecionado = null;
        }
      });

      item.appendChild(botaoExcluir);

      function aplicarFormato() {
        conteudo.style.fontFamily = memoria.fonte || "Georgia";
        conteudo.style.fontSize = `${memoria.tamanhoFonte || (ehEmoji ? 36 : 16)}px`;
        conteudo.style.color = memoria.corFonte || "#57351f";
        conteudo.style.textAlign = memoria.alinhamento || "left";

        if (ehEmoji) {
          conteudo.style.fontSize = `${memoria.tamanhoFonte || 36}px`;
        }

        if (ehFita) {
          item.style.background = memoria.corFita || "#f4d6a5cc";
          item.style.width = `${memoria.escala || 100}px`;
          item.style.height = "26px";
        } else {
          item.style.transform = `rotate(${memoria.rotacao || 0}deg) scale(${(memoria.escala || 100) / 100})`;
          item.style.transformOrigin = "top left";
        }
      }

      aplicarFormato();

      item.addEventListener("click", () => {
        item.addEventListener("pointerleave", () => {
          botaoExcluir.style.display = "none";
        });

        item.addEventListener("focusout", (evento) => {
          if (!item.contains(evento.relatedTarget)) {
            botaoExcluir.style.display = "none";
          }
        });

        selecionarElemento(item, memoria);

        document
          .querySelectorAll(".excluir-elemento-memoria")
          .forEach((botao) => {
            botao.style.display = "none";
          });

        botaoExcluir.style.display = "block";
      });

      function iniciarMovimento(evento) {
        if (evento.button !== undefined && evento.button !== 0) return;
        if (evento.target.closest("button")) return;

        // Texto: só arrasta pela borda, nunca enquanto estiver sendo editado.
        if (ehTextoEditavel && evento.target === conteudo) return;

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

          item.style.left = `${Math.max(0, Math.min(95, esquerdaInicial + dx))}%`;
          item.style.top = `${Math.max(0, Math.min(95, topoInicial + dy))}%`;

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

      item.addEventListener("pointerdown", (evento) => {
        if (evento.target === item || ehEmoji || ehFita) {
          iniciarMovimento(evento);
        }
      });

      if (ehTextoEditavel && window.ResizeObserver) {
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
        escala: tipo === "emoji-memoria" ? 100 : 100,
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
      "❤️",
      "💕",
      "💖",
      "💗",
      "💘",
      "💝",
      "💞",
      "💓",
      "✨",
      "🌟",
      "⭐",
      "🌸",
      "🌹",
      "🌷",
      "🌻",
      "🌼",
      "🥂",
      "💍",
      "💐",
      "🎂",
      "🎉",
      "🎊",
      "🦋",
      "🕊️",
      "😊",
      "🥰",
      "😍",
      "😘",
      "🤗",
      "😂",
      "🥹",
      "😎",
      "👰",
      "🤵",
      "👩‍❤️‍👨",
      "👨‍👩‍👧",
      "👨‍👩‍👦",
      "🏡",
      "🌈",
      "☀️",
      "🌙",
      "🌿",
      "🍀",
      "🌺",
      "📸",
      "🎵",
      "🎶",
      "💌",
      "🎁",
      "🧸",
      "🙏",
      "🤍",
      "🫶",
      "💫",
      "🔥",
      "👏",
      "🥳",
      "💃",
      "🕺",
      "🍾",
      "🌅",
      "📍",
      "💌",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🩷",
      "🪻",
      "🪷",
      "🪻",
      "🌱",
      "🍁",
      "🍂",
      "🌴",
      "🌊",
      "🐚",
      "🐾",
      "🐶",
      "🐱",
      "🕯️",
      "🎈",
      "🎀",
      "💎",
      "👑",
      "🧿",
      "🪄",
      "🪽",
      "🫧",
      "🪞",
      "🧵",
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

    const grupoCores = document.createElement("div");
    grupoCores.className = "grupo-cores-memora";

    const botaoCores = document.createElement("button");
    botaoCores.type = "button";
    botaoCores.className = "botao-abrir-cores";
    botaoCores.textContent = "🎨 Cor do texto";
    botaoCores.setAttribute("aria-expanded", "false");

    const paletaCores = document.createElement("div");
    paletaCores.className = "paleta-cores-memora";
    paletaCores.setAttribute("aria-label", "Cores do texto");
    paletaCores.hidden = true;

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
        paletaCores.hidden = true;
        botaoCores.setAttribute("aria-expanded", "false");
      });

      paletaCores.appendChild(amostra);
    });

    botaoCores.addEventListener("click", () => {
      const vaiAbrir = paletaCores.hidden;
      paletaCores.hidden = !vaiAbrir;
      botaoCores.setAttribute("aria-expanded", String(vaiAbrir));
    });

    grupoCores.append(botaoCores, paletaCores);

    formatacao.append(
      fonte,
      tamanhoFonte,
      grupoCores,
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
      imagem.src = obterUrl(foto);
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

      // Evita que os cliques nos controles iniciem o arraste da imagem.
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
      controles.append(diminuir, indicador, aumentar);

      figura.appendChild(controles);

      const legenda = document.createElement("figcaption");
      legenda.textContent = "";

      figura.appendChild(legenda);

      aplicarAjusteFoto();
      grade.appendChild(figura);
    }
    pagina.append(
      seletorPagina,
      tituloPagina,
      ferramentas,
      formatacao,
      grade,
      camadaMemorias,
    );
    previaAlbum.appendChild(pagina);

    indiceFoto += fotosDestaPagina.length;
    numeroPagina++;
  }

  previaAlbum.hidden = false;
  botaoVoltar.hidden = false;

  mensagemFinal.textContent = `Pré-visualização criada com ${selecionadas.size} fotografia(s).`;
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

botaoPdf.addEventListener("click", () => {
  if (previaAlbum.hidden) {
    mensagemFinal.textContent =
      "Primeiro clique em Visualizar álbum para conferir a capa e as páginas.";
    return;
  }

  mensagemFinal.textContent =
    "A pré-visualização está pronta. A geração e o download do PDF ainda precisam ser implementados.";
});

["titulo", "nomes", "dataEvento", "fraseCapa", "corTexto"].forEach((id) => {
  const campo = document.getElementById(id);
  if (!campo) return;

  campo.addEventListener("input", atualizarPreviaExistente);
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


document
  .getElementById("salvarRascunhoLateral")
  ?.addEventListener("click", salvarRascunho);

document
  .getElementById("voltarEdicaoLateral")
  ?.addEventListener("click", () => {
    botaoVoltar.click();
  });

document
  .getElementById("visualizarAlbumLateral")
  ?.addEventListener("click", () => {
    botaoVisualizar.click();
  });

carregarFotos();
