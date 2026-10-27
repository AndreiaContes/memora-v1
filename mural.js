const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
// Substitua pelo mesmo valor da chave publicável que usa em conta.js.
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const params = new URLSearchParams(window.location.search);
const EVENTO_ID = params.get("eventoId") || "";
const form = document.getElementById("formMensagem");
const nomeInput = document.getElementById("nome");
const mensagemInput = document.getElementById("mensagem");
const enviarBtn = document.getElementById("enviar");
const statusEnvio = document.getElementById("statusEnvio");
const statusLista = document.getElementById("statusLista");
const listaMensagens = document.getElementById("listaMensagens");
const contador = document.getElementById("contador");

function status(elemento, texto, tipo = "") {
  elemento.textContent = texto;
  elemento.className = `status ${tipo}`.trim();
}

function criarMensagemCard(item) {
  const card = document.createElement("article");
  card.className = "message";

  const cabecalho = document.createElement("div");
  cabecalho.className = "message-head";

  const nome = document.createElement("span");
  nome.className = "message-name";
  nome.textContent = item.nome;

  const data = document.createElement("time");
  data.className = "message-date";
  if (item.created_at) {
    const dataObj = new Date(item.created_at);
    data.dateTime = dataObj.toISOString();
    data.textContent = dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric"
    });
  }

  const texto = document.createElement("p");
  texto.className = "message-body";
  texto.textContent = item.mensagem;

  cabecalho.append(nome, data);
  card.append(cabecalho, texto);
  return card;
}

async function carregarMensagens() {
  if (!EVENTO_ID) {
    listaMensagens.replaceChildren();
    const vazio = document.createElement("div");
    vazio.className = "empty";
    vazio.textContent = "Este mural ainda não está vinculado a um evento. Abra-o pelo link correto do evento.";
    listaMensagens.appendChild(vazio);
    form.querySelectorAll("input, textarea, button").forEach((el) => { el.disabled = true; });
    status(statusLista, "O endereço precisa conter o parâmetro eventoId.", "error");
    return;
  }

  const { data, error } = await supabaseClient.rpc(
    "listar_mensagens_aprovadas",
    { p_evento_id: EVENTO_ID }
  );

  if (error) {
    console.error("Erro ao carregar mensagens do mural:", error);
    listaMensagens.replaceChildren();
    const vazio = document.createElement("div");
    vazio.className = "empty";
    vazio.textContent = "Não foi possível carregar as mensagens. Atualize a página ou tente novamente mais tarde.";
    listaMensagens.appendChild(vazio);
    return;
  }

  listaMensagens.replaceChildren();
  if (!data || data.length === 0) {
    const vazio = document.createElement("div");
    vazio.className = "empty";
    vazio.textContent = "As primeiras mensagens aprovadas aparecerão aqui. Deixe seu recado e ajude a guardar essa lembrança.";
    listaMensagens.appendChild(vazio);
    status(statusLista, "Nenhuma mensagem aprovada ainda.");
    return;
  }

  data.forEach((item) => listaMensagens.appendChild(criarMensagemCard(item)));
  status(statusLista, `${data.length} mensagem(ns) publicada(s).`);
}

mensagemInput.addEventListener("input", () => {
  contador.textContent = `${mensagemInput.value.length} / 1000`;
});

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  status(statusEnvio, "");

  if (!EVENTO_ID) {
    status(statusEnvio, "O link deste mural não contém o identificador do evento.", "error");
    return;
  }

  const nome = nomeInput.value.trim();
  const mensagem = mensagemInput.value.trim();

  if (nome.length < 2 || nome.length > 80) {
    status(statusEnvio, "O nome deve ter entre 2 e 80 caracteres.", "error");
    return;
  }
  if (mensagem.length < 3 || mensagem.length > 1000) {
    status(statusEnvio, "A mensagem deve ter entre 3 e 1.000 caracteres.", "error");
    return;
  }

  enviarBtn.disabled = true;
  enviarBtn.textContent = "Enviando...";

  try {
    const { error } = await supabaseClient
      .from("mural_mensagens")
      .insert({ evento_id: EVENTO_ID, nome, mensagem, status: "pendente" });

    if (error) throw error;

    form.reset();
    contador.textContent = "0 / 1000";
    status(statusEnvio, "Recado enviado! Ele aparecerá no mural depois de ser aprovado.", "success");
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    status(statusEnvio, "Não foi possível enviar o recado. Confira o link do evento e tente novamente.", "error");
  } finally {
    enviarBtn.disabled = false;
    enviarBtn.textContent = "Enviar mensagem";
  }
});

document.getElementById("voltar").addEventListener("click", () => {
  if (window.history.length > 1) window.history.back();
  else window.location.href = "dashboard.html";
});

carregarMensagens();
