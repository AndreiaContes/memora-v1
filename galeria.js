// Configuração Supabase
const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("GALERIA V2");

const params = new URLSearchParams(window.location.search);
let evento = params.get("evento") || "default";

let listaFotos = [];
let indiceAtual = 0;
let filtroAtual = "todas";
let curtidasPorFoto = {};

document.addEventListener("DOMContentLoaded", () => {
  carregarGaleriaPublica();

  // Menu Sidebar
  const menuSidebar = document.getElementById("menuSidebar");
  const menuOverlay = document.getElementById("menuOverlay");
  const openMenuBtn = document.getElementById("openMenuBtn");
  const closeMenuBtn = document.getElementById("closeMenuBtn");

  openMenuBtn?.addEventListener("click", () => {
    menuSidebar.classList.add("menu-active");
    menuOverlay.classList.add("active");
  });

  closeMenuBtn?.addEventListener("click", () => {
    menuSidebar.classList.remove("menu-active");
    menuOverlay.classList.remove("active");
  });

  menuOverlay?.addEventListener("click", () => {
    menuSidebar.classList.remove("menu-active");
    menuOverlay.classList.remove("active");
  });

  // Filtros
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.remove("active");
      });

      btn.classList.add("active");
      filtroAtual = btn.dataset.filter;
      renderizarGaleria();
    });
  });
});

async function carregarCurtidas() {
  const { data, error } = await supabaseClient
    .from("curtidas")
    .select("foto_id")
    .eq("evento", evento);

  if (error) {
    console.error("Erro ao carregar curtidas:", error.message);
    return;
  }

  curtidasPorFoto = {};

  data.forEach((item) => {
    if (!curtidasPorFoto[item.foto_id]) {
      curtidasPorFoto[item.foto_id] = 0;
    }
    curtidasPorFoto[item.foto_id]++;
  });
}

async function carregarGaleriaPublica() {
  const grid = document.getElementById("albumGrid");
  grid.innerHTML =
    "<p style='text-align:center; color:#ccc;'>Buscando lembranças...</p>";

  const { data, error } = await supabaseClient.storage
    .from("fotos-eventos")
    .list(evento, {
      sortBy: { column: "name", order: "desc" },
    });

  if (error) {
    grid.innerHTML =
      "<p style='color:red; text-align:center;'>Erro: " +
      error.message +
      "</p>";
    return;
  }

  listaFotos = data.filter((item) => item.name !== ".emptyFolderPlaceholder");

  await carregarCurtidas();
  renderizarGaleria();
}

function renderizarGaleria() {
  const grid = document.getElementById("albumGrid");

  if (listaFotos.length === 0) {
    grid.innerHTML =
      "<p style='text-align:center; color:#aaa;'>Nenhuma foto encontrada.</p>";
    return;
  }

  let fotosOrdenadas = [...listaFotos].reverse();
  if (filtroAtual === "todas") {
    fotosOrdenadas = [...listaFotos].reverse();
  }

  if (filtroAtual === "recentes") {
    fotosOrdenadas.sort((a, b) => b.name.localeCompare(a.name));
  }

  if (filtroAtual === "curtidas") {
    fotosOrdenadas.sort((a, b) => {
      const likesA = curtidasPorFoto[a.name] || 0;
      const likesB = curtidasPorFoto[b.name] || 0;

      if (likesB !== likesA) {
        return likesB - likesA;
      }

      // Empate: mais recente primeiro
      return b.name.localeCompare(a.name);
    });
  }

  grid.innerHTML = "";

  fotosOrdenadas.forEach((item) => {
    const likes = curtidasPorFoto[item.name] || 0;

    const url = `${SUPABASE_URL}/storage/v1/object/public/fotos-eventos/${evento}/${item.name}`;

    const originalIndex = listaFotos.findIndex(
      (foto) => foto.name === item.name,
    );

    const container = document.createElement("div");
    container.classList.add("photo-wrapper");

    container.innerHTML = `
      <img src="${url}" loading="lazy" onclick="openZoomModal(${originalIndex})">
      <button class="like-btn" onclick="curtirFoto('${item.name}', this)">
        ♡ ${likes}
      </button>
    `;

    grid.appendChild(container);
  });
}

function openZoomModal(index) {
  indiceAtual = index;

  const modal = document.getElementById("gallery-zoom-modal");
  const imgElement = modal.querySelector(".zoom-img");

  imgElement.src = `${SUPABASE_URL}/storage/v1/object/public/fotos-eventos/${evento}/${listaFotos[indiceAtual].name}`;

  modal.style.display = "flex";
}

function mudarFoto(direcao) {
  indiceAtual = (indiceAtual + direcao + listaFotos.length) % listaFotos.length;

  openZoomModal(indiceAtual);
}

async function curtirFoto(nomeArquivo, botao) {
  if (botao.classList.contains("curtido")) return;

  console.log("EVENTO ENVIADO:", evento);

  const { error } = await supabaseClient.from("curtidas").insert([
    {
      foto_id: nomeArquivo,
      evento: evento,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("Erro ao curtir:", error.message);
    alert("Erro ao enviar curtida.");
    return;
  }

  botao.classList.add("curtido");

  if (!curtidasPorFoto[nomeArquivo]) {
    curtidasPorFoto[nomeArquivo] = 0;
  }

  curtidasPorFoto[nomeArquivo]++;

  botao.innerHTML = `❤️ ${curtidasPorFoto[nomeArquivo]}`;

  if (filtroAtual === "curtidas") {
    renderizarGaleria();
  }
}
