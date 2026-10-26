const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";

// Copie para esta linha a mesma chave PUBLICÁVEL usada no conta.js.
// Não use uma chave service_role ou secret.
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tituloBoasVindas = document.getElementById("tituloBoasVindas");
const mensagemDashboard = document.getElementById("mensagemDashboard");
const listaEventos = document.getElementById("listaEventos");
const botaoSair = document.getElementById("botaoSair");

function mostrarMensagem(texto, tipo = "") {
  mensagemDashboard.textContent = texto;
  mensagemDashboard.className = tipo ? `mensagem ${tipo}` : "mensagem";
  mensagemDashboard.hidden = false;
}

function criarLinkEvento(texto, arquivo, evento, classe = "") {
  const link = document.createElement("a");
  link.className = `botao ${classe}`.trim();
  link.textContent = texto;

  // A pasta de fotos é diferente do identificador do evento no banco.
  const pastaFotos = evento.storage_folder || evento.slug;

  const url = new URL(arquivo, window.location.href);
  url.searchParams.set("evento", pastaFotos);

  // Guardamos também o UUID para a futura integração multi-evento.
  url.searchParams.set("eventoId", evento.id);

  link.href = url.href;

  return link;
}

function criarCartaoEvento(evento) {
  const cartao = document.createElement("article");
  cartao.className = "evento-card";

  const icone = document.createElement("div");
  icone.className = "evento-icone";
  icone.textContent = "♡";
  icone.setAttribute("aria-hidden", "true");

  const titulo = document.createElement("h4");
  titulo.textContent = evento.nome || "Meu evento";

  const descricao = document.createElement("p");
  descricao.textContent = "Acesse as fotos ou abra o editor de álbuns.";

  const status = document.createElement("span");
  status.className = "evento-status";
  status.textContent = evento.evento_ativo ? "Evento ativo" : "Evento inativo";

  const acoes = document.createElement("div");
  acoes.className = "evento-acoes";

  const linkGaleria = criarLinkEvento(
    "Abrir galeria",
    "galeria-app.html",
    evento,
  );

  const linkEditor = criarLinkEvento(
    "Editar álbum",
    "editar-album.html",
    evento,
    "botao-secundario",
  );

  const linkTelao = criarLinkEvento(
    "Abrir telão",
    "telao.html",
    evento,
    "botao-secundario",
  );

  const linkVideo = criarLinkEvento(
    "Vídeo de recordações",
    "video-recordacoes.html",
    evento,
    "botao-secundario",
  );
  const linkMural = criarLinkEvento(
    "Mural de Recados",
    "mural-admin.html",
    evento,
    "botao-secundario",
  );

  acoes.append(linkGaleria, linkEditor, linkTelao, linkVideo, linkMural);

  cartao.append(icone, titulo, descricao, status, acoes);

  return cartao;
}

async function iniciarDashboard() {
  listaEventos.hidden = true;

  const { data: sessaoData, error: erroSessao } =
    await supabaseClient.auth.getSession();

  if (erroSessao) {
    console.error("Erro ao consultar a sessão:", erroSessao);
    mostrarMensagem(
      "Não foi possível verificar seu acesso. Atualize a página e tente novamente.",
      "erro",
    );
    return;
  }

  const sessao = sessaoData.session;

  if (!sessao) {
    window.location.replace("conta.html");
    return;
  }

  const usuario = sessao.user;
  const nome = usuario.user_metadata?.nome;

  tituloBoasVindas.textContent = nome
    ? `Bem-vinda, ${nome}!`
    : "Bem-vinda ao seu espaço!";

  // Selecionamos somente as colunas permitidas, nunca a coluna senha.
  const { data: eventos, error } = await supabaseClient
    .from("eventos")
    .select(
      "id, nome, slug, storage_folder, telao_ativo, evento_ativo, created_at, owner_id",
    )
    .eq("owner_id", usuario.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar eventos:", error);
    mostrarMensagem(
      "Não foi possível carregar seus eventos. Confira sua conexão e tente novamente.",
      "erro",
    );
    return;
  }

  listaEventos.replaceChildren();

  if (!eventos || eventos.length === 0) {
    mostrarMensagem(
      "Sua conta ainda não possui eventos vinculados. Quando um evento for associado à sua conta, ele aparecerá aqui.",
    );
    return;
  }

  eventos.forEach((evento) => {
    listaEventos.appendChild(criarCartaoEvento(evento));
  });

  mensagemDashboard.hidden = true;
  listaEventos.hidden = false;
}

botaoSair.addEventListener("click", async () => {
  botaoSair.disabled = true;
  botaoSair.textContent = "Saindo...";

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Erro ao sair:", error);
    mostrarMensagem(
      "Não foi possível encerrar a sessão. Tente novamente.",
      "erro",
    );
    botaoSair.disabled = false;
    botaoSair.textContent = "Sair da conta";
    return;
  }

  window.location.replace("conta.html");
});

iniciarDashboard();
