const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const parametros = new URLSearchParams(window.location.search);
const EVENTO_ID = parametros.get("eventoId") || "";

const postitsLayer = document.getElementById("postitsLayer");
const listaMobile = document.getElementById("lista");
const statusEl = document.getElementById("status");
const hiddenMessagesPanel = document.getElementById("hiddenMessagesPanel");

const hiddenMessagesList = document.getElementById("hiddenMessagesList");
const tituloEvento = document.getElementById("tituloEvento");
const pageInfo = document.getElementById("pageInfo");
const botaoAnterior = document.getElementById("prevMural");
const botaoProximo = document.getElementById("nextMural");

const POSTITS_POR_MURAL = 15;

let mensagens = [];
let postits = [];
let paginaAtual = 0;
let atualizandoMensagem = false;

/*
 * Posições dos post-its na imagem de fundo.
 * Cada mensagem ocupará apenas um post-it.
 */
const POSICOES_POSTITS = [
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

/* Mensagens de status da página. */
function mostrarStatus(texto, tipo = "") {
  if (!statusEl) return;

  statusEl.textContent = texto;
  statusEl.className = `status ${tipo}`.trim();
}

/* Formatação da data de envio. */
function formatarData(valor) {
  if (!valor) return "";

  const data = new Date(valor);

  return Number.isNaN(data.getTime()) ? "" : data.toLocaleString("pt-BR");
}

/* Criação segura de elementos HTML. */
function criarElemento(tag, classe, texto = "") {
  const elemento = document.createElement(tag);

  if (classe) {
    elemento.className = classe;
  }

  if (texto !== undefined && texto !== null) {
    elemento.textContent = texto;
  }

  return elemento;
}

/*
 * Estilos complementares.
 * O texto do post-it é limitado visualmente, mas a mensagem original
 * permanece intacta no objeto recebido do Supabase.
 */
function prepararEstilosExtras() {
  if (document.getElementById("estilosExtrasMural")) {
    return;
  }

  const estilo = document.createElement("style");
  estilo.id = "estilosExtrasMural";

  estilo.textContent = `
    .postit-message {
      display: -webkit-box;
      max-width: 100%;
      max-height: calc(1.3em * 5);
      overflow: hidden;
      color: #382a27;
      font-size: clamp(9px, 0.95vw, 14px);
      line-height: 1.3;
      text-align: center;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 5;
      line-clamp: 5;
      text-overflow: ellipsis;
    }

    .postit.is-hidden {
      opacity: 0.58;
      filter: saturate(0.65);
    }

    .postit-state {
      position: absolute;
      top: 9%;
      right: 5%;
      padding: 2px 4px;
      border-radius: 6px;
      background: rgba(40, 26, 15, 0.82);
      color: #fff0ca;
      font: bold 7px Arial, sans-serif;
    }

    .mobile-wall .list {
      display: grid;
      gap: 12px;
    }

    .mobile-toggle {
      margin-top: 12px;
      padding: 8px 12px;
      border: 1px solid #c6a15b;
      border-radius: 8px;
      background: transparent;
      color: #e4c783;
      cursor: pointer;
    }

    
    .mural-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(15, 10, 7, 0.78);
      overflow-y: auto;
    }

    /* O recado aberto assume o formato de um post-it. */
    .mural-dialog {
      position: relative;
      width: min(100%, 540px);
      max-height: 85vh;
      overflow-y: auto;
      padding: 48px 30px 28px;
      border: 1px solid rgba(177, 137, 72, 0.45);
      border-radius: 5px;
      background:
        repeating-linear-gradient(
          0deg,
          rgba(112, 79, 43, 0.025) 0px,
          rgba(112, 79, 43, 0.025) 1px,
          transparent 1px,
          transparent 7px
        ),
        linear-gradient(
          135deg,
          #fff3d8 0%,
          #f8e8c8 55%,
          #f1dfb7 100%
        );
      color: #382a27;
      box-shadow:
        0 22px 65px rgba(0, 0, 0, 0.45),
        3px 5px 0 rgba(0, 0, 0, 0.12);
      transform: rotate(-0.6deg);
    }

    /* Tachinha dourada no alto do post-it. */
    .mural-dialog::before {
      content: "";
      position: absolute;
      top: 13px;
      left: 50%;
      width: 17px;
      height: 17px;
      border-radius: 50%;
      background:
        radial-gradient(
          circle at 30% 25%,
          #fff2b6 0%,
          #d9af51 35%,
          #9e702b 75%,
          #714a1c 100%
        );
      box-shadow:
        1px 3px 4px rgba(60, 35, 12, 0.35),
        inset 0 1px 2px rgba(255, 255, 255, 0.8);
      transform: translateX(-50%);
    }

    .mural-dialog h2 {
      margin: 0 0 12px;
      color: #553b29;
      font-family: "Segoe Print", "Bradley Hand", cursive;
      font-size: clamp(19px, 4vw, 25px);
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .mural-dialog-message {
      margin: 18px 0;
      color: #382a27;
      font-family: "Segoe Print", "Bradley Hand", cursive;
      font-size: 16px;
      line-height: 1.9;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      overflow: visible;
    }

    .mural-dialog-date,
    .mural-dialog-state {
      color: #80694f;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.6;
    }

    .mural-dialog-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 22px;
    }

    .mural-dialog-actions button {
      padding: 10px 14px;
      border: 1px solid #937044;
      border-radius: 8px;
      background: rgba(255, 250, 235, 0.75);
      color: #553b29;
      font-family: Arial, Helvetica, sans-serif;
      cursor: pointer;
    }

    .mural-dialog-actions button:hover {
      background: #f2dfb7;
    }

    .mural-dialog-actions button:disabled {
      opacity: 0.5;
      cursor: wait;
    }

    .mural-dialog-actions .mural-action-primary {
      border-color: #ba8e43;
      background: #d8b568;
      color: #30200e;
      font-weight: bold;
    }

    .mural-dialog-actions .mural-action-primary:hover {
      background: #e6c780;
    }

    @media (max-width: 600px) {
      .mural-dialog-backdrop {
        padding: 14px;
      }

      .mural-dialog {
        width: 100%;
        max-height: 88vh;
        padding: 44px 22px 22px;
        transform: rotate(-0.3deg);
      }

      .mural-dialog-message {
        font-size: 15px;
        line-height: 1.85;
      }
    }

  `;

  document.head.appendChild(estilo);
}

/*
 * Uma mensagem do Supabase corresponde a um único post-it.
 * Não dividimos, modificamos nem regravamos seu texto.
 */
function montarPostits() {
  postits = mensagens.map((mensagem) => ({
    ...mensagem,
    textoPostit: mensagem.mensagem,
  }));
}

function renderizarMensagensOcultas() {
  if (!hiddenMessagesPanel || !hiddenMessagesList) return;

  const ocultas = mensagens.filter((item) => item.status !== "aprovada");

  hiddenMessagesList.replaceChildren();
  hiddenMessagesPanel.hidden = ocultas.length === 0;

  ocultas.forEach((item) => {
    const card = criarElemento("article", "hidden-message-card");

    const nome = criarElemento("strong", "", item.nome);

    const texto = criarElemento("p", "", item.mensagem);

    const botao = criarElemento("button", "", "Voltar a exibir no mural");

    botao.type = "button";

    botao.addEventListener("click", async () => {
      botao.disabled = true;

      const sucesso = await alternarVisibilidadeMensagem(item);

      if (!sucesso) {
        botao.disabled = false;
      }
    });

    card.append(nome, texto, botao);
    hiddenMessagesList.appendChild(card);
  });
}

/* Cartões de mensagem para a versão mobile. */
function criarCartaoMobile(item) {
  const card = criarElemento("article", "mobile-card");

  const nome = criarElemento("h3", "", item.nome);

  const mensagem = criarElemento("p", "", item.mensagem);

  const data = criarElemento(
    "span",
    "mobile-date",
    formatarData(item.created_at),
  );

  const textoEstado =
    item.status === "aprovada" ? "Publicado no mural" : "Oculto do mural";

  const estado = criarElemento("span", "mobile-date", textoEstado);

  const botao = criarElemento(
    "button",
    "mobile-toggle",
    item.status === "aprovada" ? "Ocultar do mural" : "Mostrar no mural",
  );

  botao.type = "button";

  botao.addEventListener("click", () => {
    abrirDetalhesMensagem(item);
  });

  card.append(nome, mensagem, data, estado, botao);

  return card;
}

/* Cria um post-it para uma mensagem inteira. */
function criarPostit(item, posicao) {
  const postit = criarElemento("button", "postit");

  postit.type = "button";

  postit.setAttribute(
    "aria-label",
    `Recado de ${item.nome}. Clique para ler a mensagem completa.`,
  );

  postit.style.setProperty("--left", posicao.left);
  postit.style.setProperty("--top", posicao.top);
  postit.style.setProperty("--width", posicao.width);
  postit.style.setProperty("--height", posicao.height);
  postit.style.setProperty("--rotation", posicao.rotation);

  const mensagem = criarElemento("span", "postit-message", item.mensagem);

  const nome = criarElemento("span", "postit-name", `— ${item.nome}`);

  postit.append(mensagem, nome);

  if (item.status !== "aprovada") {
    postit.classList.add("is-hidden");
    postit.title = "Esta mensagem está oculta do mural público.";

    postit.appendChild(criarElemento("span", "postit-state", "OCULTA"));
  } else {
    postit.title = "Clique para ler a mensagem completa.";
  }

  postit.addEventListener("click", () => {
    abrirDetalhesMensagem(item);
  });

  return postit;
}

/* Atualiza a navegação entre as páginas do mural. */
function atualizarNavegacao(totalMurais, inicio, fim) {
  if (pageInfo) {
    pageInfo.textContent = totalMurais
      ? `Mural ${paginaAtual + 1} de ${totalMurais} · Mensagens ${inicio + 1}–${fim} de ${mensagens.length}`
      : "Nenhum mural disponível";
  }

  if (botaoAnterior) {
    botaoAnterior.disabled = paginaAtual === 0;
  }

  if (botaoProximo) {
    botaoProximo.disabled = totalMurais === 0 || paginaAtual >= totalMurais - 1;
  }
}

/* Desenha o mural atual. */
function renderizar() {
  postitsLayer?.replaceChildren();
  listaMobile?.replaceChildren();

  // Mantém a recuperação dos recados ocultos fora do mural.
  renderizarMensagensOcultas();

  // Só as mensagens publicadas entram nos post-its.
  const postitsPublicados = postits.filter(
    (item) => item.status === "aprovada",
  );

  // No celular, continuamos mostrando a lista completa ao anfitrião.
  if (listaMobile) {
    mensagens.forEach((item) => {
      listaMobile.appendChild(criarCartaoMobile(item));
    });
  }

  if (postitsPublicados.length === 0) {
    if (pageInfo) {
      pageInfo.textContent = "Nenhuma mensagem publicada";
    }

    if (botaoAnterior) {
      botaoAnterior.disabled = true;
    }

    if (botaoProximo) {
      botaoProximo.disabled = true;
    }

    mostrarStatus(
      mensagens.length
        ? "Não há mensagens publicadas. As mensagens ocultas podem ser recuperadas abaixo."
        : "Ainda não há mensagens neste evento.",
    );

    return;
  }

  const totalMurais = Math.ceil(postitsPublicados.length / POSTITS_POR_MURAL);

  paginaAtual = Math.max(0, Math.min(paginaAtual, totalMurais - 1));

  const inicio = paginaAtual * POSTITS_POR_MURAL;

  const fim = Math.min(inicio + POSTITS_POR_MURAL, postitsPublicados.length);

  const postitsDaPagina = postitsPublicados.slice(inicio, fim);

  postitsDaPagina.forEach((item, indice) => {
    const posicao = POSICOES_POSTITS[indice];

    if (postitsLayer && posicao) {
      postitsLayer.appendChild(criarPostit(item, posicao));
    }
  });

  if (pageInfo) {
    pageInfo.textContent =
      `Mural ${paginaAtual + 1} de ${totalMurais} · ` +
      `Mensagens ${inicio + 1}–${fim} de ${postitsPublicados.length}`;
  }

  if (botaoAnterior) {
    botaoAnterior.disabled = paginaAtual === 0;
  }

  if (botaoProximo) {
    botaoProximo.disabled = paginaAtual >= totalMurais - 1;
  }

  const ocultas = mensagens.length - postitsPublicados.length;

  mostrarStatus(
    `${postitsPublicados.length} mensagem(ns) publicada(s)` +
      (ocultas ? ` · ${ocultas} oculta(s)` : ""),
  );
}

/* Busca as mensagens do evento atual. */
async function carregarMensagens() {
  const { data, error } = await supabaseClient
    .from("mural_mensagens")
    .select("id, evento_id, nome, mensagem, status, created_at")
    .eq("evento_id", EVENTO_ID)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar mensagens:", error);

    mostrarStatus("Não foi possível carregar as mensagens do evento.", "error");

    return false;
  }

  mensagens = data || [];

  montarPostits();
  renderizar();

  return true;
}

function fecharDialogo(dialogo, aoFechar) {
  dialogo?.remove();

  if (aoFechar) {
    document.removeEventListener("keydown", aoFechar);
  }
}

/* Abre o texto integral ao clicar no post-it. */
function abrirDetalhesMensagem(item) {
  prepararEstilosExtras();

  const fundo = criarElemento("div", "mural-dialog-backdrop");

  fundo.setAttribute("role", "presentation");

  const dialogo = criarElemento("section", "mural-dialog");

  dialogo.setAttribute("role", "dialog");
  dialogo.setAttribute("aria-modal", "true");
  dialogo.setAttribute("aria-labelledby", "muralDialogTitle");

  const titulo = criarElemento("h2", "", `Recado de ${item.nome}`);

  titulo.id = "muralDialogTitle";

  const data = criarElemento(
    "p",
    "mural-dialog-date",
    formatarData(item.created_at),
  );

  // IMPORTANTE: aqui usamos a mensagem original completa.
  const mensagem = criarElemento("p", "mural-dialog-message", item.mensagem);

  const publicado = item.status === "aprovada";

  const estado = criarElemento(
    "p",
    "mural-dialog-state",
    publicado
      ? "Este recado está visível no mural público."
      : "Este recado está oculto do mural público.",
  );

  const acoes = criarElemento("div", "mural-dialog-actions");

  const botaoVisibilidade = criarElemento(
    "button",
    "mural-action-primary",
    publicado ? "Ocultar do mural" : "Mostrar no mural",
  );

  botaoVisibilidade.type = "button";

  botaoVisibilidade.addEventListener("click", async () => {
    botaoVisibilidade.disabled = true;

    const sucesso = await alternarVisibilidadeMensagem(item);

    if (sucesso) {
      fecharDialogo(fundo, teclaEscape);
    } else {
      botaoVisibilidade.disabled = false;
    }
  });

  const botaoFechar = criarElemento("button", "", "Fechar");

  botaoFechar.type = "button";

  botaoFechar.addEventListener("click", () => {
    fecharDialogo(fundo, teclaEscape);
  });

  acoes.append(botaoVisibilidade, botaoFechar);

  dialogo.append(titulo, data, mensagem, estado, acoes);

  fundo.appendChild(dialogo);

  fundo.addEventListener("click", (event) => {
    if (event.target === fundo) {
      fecharDialogo(fundo, teclaEscape);
    }
  });

  function teclaEscape(event) {
    if (event.key === "Escape") {
      fecharDialogo(fundo, teclaEscape);
    }
  }

  document.addEventListener("keydown", teclaEscape);

  document.body.appendChild(fundo);
  botaoFechar.focus();
}

/* Oculta ou volta a exibir uma mensagem, sem apagá-la. */
async function alternarVisibilidadeMensagem(item) {
  if (atualizandoMensagem) {
    return false;
  }

  atualizandoMensagem = true;

  const novoStatus = item.status === "aprovada" ? "rejeitada" : "aprovada";

  mostrarStatus("Atualizando a mensagem...");

  try {
    const { error } = await supabaseClient
      .from("mural_mensagens")
      .update({ status: novoStatus })
      .eq("id", item.id)
      .eq("evento_id", EVENTO_ID);

    if (error) {
      throw error;
    }

    const carregou = await carregarMensagens();

    if (!carregou) {
      return false;
    }

    mostrarStatus(
      novoStatus === "aprovada"
        ? "Mensagem exibida no mural público."
        : "Mensagem ocultada do mural público.",
      "success",
    );

    return true;
  } catch (error) {
    console.error("Erro ao atualizar mensagem:", error);

    mostrarStatus(
      "Não foi possível alterar a visibilidade. Confira as permissões.",
      "error",
    );

    return false;
  } finally {
    atualizandoMensagem = false;
  }
}

/* Voltar para o mural anterior. */
if (botaoAnterior) {
  botaoAnterior.addEventListener("click", () => {
    if (paginaAtual > 0) {
      paginaAtual--;
      renderizar();

      postitsLayer?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  });
}

/* Avançar para o próximo mural. */
if (botaoProximo) {
  botaoProximo.addEventListener("click", () => {
    // Contar somente os post-its das mensagens publicadas.
    const postitsPublicados = postits.filter(
      (item) => item.status === "aprovada",
    );

    const totalMurais = Math.ceil(postitsPublicados.length / POSTITS_POR_MURAL);

    if (paginaAtual < totalMurais - 1) {
      paginaAtual++;
      renderizar();

      postitsLayer?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  });
}

/* Valida a sessão e o proprietário do evento. */
async function iniciar() {
  prepararEstilosExtras();

  if (!postitsLayer || !tituloEvento || !statusEl) {
    console.error(
      "Não encontrei os elementos do mural. Confira o mural-admin.html.",
    );

    return;
  }

  if (!EVENTO_ID) {
    window.location.replace("dashboard.html");
    return;
  }

  try {
    const { data: sessaoData, error: erroSessao } =
      await supabaseClient.auth.getSession();

    if (erroSessao || !sessaoData?.session) {
      window.location.replace("conta.html");
      return;
    }

    const usuario = sessaoData.session.user;

    const { data: evento, error: erroEvento } = await supabaseClient
      .from("eventos")
      .select("id, nome, owner_id")
      .eq("id", EVENTO_ID)
      .eq("owner_id", usuario.id)
      .maybeSingle();

    if (erroEvento) {
      throw erroEvento;
    }

    if (!evento) {
      mostrarStatus("Você não tem acesso a este evento.", "error");

      postitsLayer.replaceChildren();

      if (listaMobile) {
        listaMobile.replaceChildren(
          criarElemento(
            "div",
            "empty",
            "Entre com a conta proprietária do evento e abra o mural pelo Diário Memora.",
          ),
        );
      }

      if (pageInfo) {
        pageInfo.textContent = "Acesso não autorizado";
      }

      if (botaoAnterior) {
        botaoAnterior.disabled = true;
      }

      if (botaoProximo) {
        botaoProximo.disabled = true;
      }

      return;
    }

    tituloEvento.textContent = evento.nome;

    document.title = `Mural de Recados — ${evento.nome} | Memora`;

    await carregarMensagens();
  } catch (error) {
    console.error("Erro ao iniciar o mural:", error);

    mostrarStatus(
      "Não foi possível abrir o mural. Confira sua conexão e as permissões.",
      "error",
    );
  }
}

iniciar();
