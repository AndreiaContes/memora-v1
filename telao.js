// telao.js
const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const fotoTelao = document.getElementById("fotoTelao");
const frame = document.getElementById("frame");
const contador = document.getElementById("contadorFotos");

const parametrosURL = new URLSearchParams(window.location.search);
const evento = parametrosURL.get("evento") || "default";

let fotos = [];
let indexAtual = 0;

// --- REALTIME: ESCUTA O BANCO ---
// Este bloco faz o coração subir quando alguém insere uma linha na tabela 'curtidas'
client
  .channel("canal-curtidas")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "curtidas",
      filter: `evento=eq.${evento}`,
    },
    (payload) => {
      console.log("CURTIDA RECEBIDA:", payload);
      exibirCoracaoNaTela();
    },
  )
  .subscribe((status) => {
    console.log("STATUS REALTIME:", status);
  });

function exibirCoracaoNaTela() {
  const coracao = document.createElement("div");
  coracao.innerHTML = "❤️";
  coracao.className = "coracao-animado";
  document.body.appendChild(coracao);
  // Remove o elemento após a animação para não sobrecarregar o navegador
  setTimeout(() => coracao.remove(), 2500);
}

// --- FLUXO DE FOTOS (MANTIDO) ---
async function carregarFotos() {
  const { data } = await client.storage
    .from("fotos-eventos")
    .list(evento, { limit: 500 });
  if (!data) return;

  fotos = data
    .filter((item) => item.name !== ".emptyFolderPlaceholder")
    .map((item) => ({
      url: `${SUPABASE_URL}/storage/v1/object/public/fotos-eventos/${evento}/${item.name}`,
    }));

  contador.textContent = `${fotos.length} fotos`;
}

function mostrarFoto() {
  if (fotos.length === 0) return;
  frame.classList.remove("ativa");
  setTimeout(() => {
    fotoTelao.src = fotos[indexAtual].url;
    frame.classList.add("ativa");
    indexAtual = (indexAtual + 1) % fotos.length;
  }, 1000);
}

carregarFotos().then(mostrarFoto);
setInterval(mostrarFoto, 7000);
setInterval(carregarFotos, 30000);

