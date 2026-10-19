
const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const BUCKET = "fotos-eventos";
const EVENTO = new URLSearchParams(window.location.search)
  .get("evento") || "default";

const galeria = document.getElementById("galeria");
const status = document.getElementById("status");
const visualizador = document.getElementById("visualizador");
const fotoAmpliada = document.getElementById("foto-ampliada");
const botaoFechar = document.getElementById("fechar");

let listaFotos = [];
let curtidasPorFoto = {};
let filtroAtual = "todas";

async function carregarCurtidas() {
  const { data, error } = await supabaseClient
    .from("curtidas")
    .select("foto_id")
    .eq("evento", EVENTO);

  if (error) {
    console.error("Erro ao carregar curtidas:", error.message);
    return false;
  }

  curtidasPorFoto = {};

  (data || []).forEach((item) => {
    curtidasPorFoto[item.foto_id] =
      (curtidasPorFoto[item.foto_id] || 0) + 1;
  });

  return true;
}

async function carregarFotos() {
  status.textContent = "Carregando fotos...";

  const { data, error } = await supabaseClient.storage
    .from(BUCKET)
    .list(EVENTO, {
      limit: 100,
      sortBy: { column: "name", order: "desc" }
    });

  if (error) {
    console.error("Erro ao carregar fotos:", error.message);
    status.textContent = "Não foi possível carregar as fotos.";
    return;
  }

  listaFotos = (data || []).filter((item) =>
    item.name &&
    item.name !== ".emptyFolderPlaceholder" &&
    /\.(jpe?g|png|webp|gif|avif)$/i.test(item.name)
  );

  const curtidasCarregadas = await carregarCurtidas();

  if (!curtidasCarregadas) {
    status.textContent =
      "As fotos foram localizadas, mas não foi possível carregar as curtidas.";
  } else if (listaFotos.length === 0) {
    status.textContent = "Ainda não há fotos neste evento.";
  } else {
    status.textContent = `${listaFotos.length} foto(s) encontradas.`;
  }

  renderizarGaleria();
}

function renderizarGaleria() {
  galeria.replaceChildren();

  document.querySelectorAll(".filtro").forEach((botao) => {
    const ativo = botao.dataset.filtro === filtroAtual;
    botao.classList.toggle("ativo", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
  });

  let fotosOrdenadas = [...listaFotos];

  if (filtroAtual === "recentes" || filtroAtual === "todas") {
    fotosOrdenadas.sort((a, b) => b.name.localeCompare(a.name));
  }

  if (filtroAtual === "curtidas") {
    fotosOrdenadas.sort((a, b) => {
      const likesA = curtidasPorFoto[a.name] || 0;
      const likesB = curtidasPorFoto[b.name] || 0;

      if (likesB !== likesA) {
        return likesB - likesA;
      }

      return b.name.localeCompare(a.name);
    });
  }

  fotosOrdenadas.forEach((item) => {
    const { data: publicData } = supabaseClient.storage
      .from(BUCKET)
      .getPublicUrl(`${EVENTO}/${item.name}`);

    const container = document.createElement("div");
    container.className = "photo-wrapper";

    const imagem = document.createElement("img");
    imagem.className = "foto";
    imagem.src = publicData.publicUrl;
    imagem.alt = "Foto do evento";
    imagem.loading = "lazy";

    imagem.addEventListener("click", () => {
      abrirFoto(item.name);
    });

    const contador = document.createElement("span");
    contador.className = "like-count";
    contador.textContent = `♥ ${curtidasPorFoto[item.name] || 0}`;

    container.append(imagem, contador);
    galeria.appendChild(container);
  });
}

function abrirFoto(nomeArquivo) {
  const { data } = supabaseClient.storage
    .from(BUCKET)
    .getPublicUrl(`${EVENTO}/${nomeArquivo}`);

  fotoAmpliada.src = data.publicUrl;
  fotoAmpliada.alt = "Foto ampliada do evento";
  visualizador.classList.add("aberto");
  botaoFechar.focus();
}

function fecharVisualizador() {
  visualizador.classList.remove("aberto");
  fotoAmpliada.removeAttribute("src");
}

document.querySelectorAll(".filtro").forEach((botao) => {
  botao.addEventListener("click", () => {
    filtroAtual = botao.dataset.filtro;
    renderizarGaleria();
  });
});

botaoFechar.addEventListener("click", fecharVisualizador);

visualizador.addEventListener("click", (event) => {
  if (event.target === visualizador) {
    fecharVisualizador();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    fecharVisualizador();
  }
});

carregarFotos();
setInterval(carregarFotos, 30000);


function adicionarBotaoVoltarDashboard() {
  if (document.getElementById("memora-voltar-dashboard")) return;

  const botao = document.createElement("a");
  botao.id = "memora-voltar-dashboard";
  botao.href = "dashboard.html";
  botao.textContent = "← Voltar ao painel";
  botao.setAttribute("aria-label", "Voltar ao Dashboard do Memora");

  Object.assign(botao.style, {
    position: "fixed",
    top: "16px",
    left: "16px",
    zIndex: "10000",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "11px 16px",
    border: "1px solid #c6a15b",
    borderRadius: "10px",
    background: "rgba(23, 23, 23, 0.96)",
    color: "#e4c783",
    font: "600 14px Arial, sans-serif",
    textDecoration: "none",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)"
  });

  document.body.appendChild(botao);
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    adicionarBotaoVoltarDashboard
  );
} else {
  adicionarBotaoVoltarDashboard();
}

