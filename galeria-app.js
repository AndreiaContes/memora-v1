
const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";

// Utilize a mesma chave pública já usada pelo Memora V1.
// Não coloque aqui uma chave service_role ou secret.
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

async function carregarFotos() {
  status.textContent = "Carregando fotos...";

  const { data, error } = await supabaseClient.storage
    .from(BUCKET)
    .list(EVENTO, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" }
    });

  if (error) {
    console.error("Erro ao carregar fotos:", error);
    status.textContent =
      "Não foi possível carregar as fotos. Tente novamente mais tarde.";
    return;
  }

  const fotos = (data || []).filter(item =>
    item.name &&
    !item.name.endsWith("/") &&
    /\.(jpe?g|png|webp|gif|avif)$/i.test(item.name)
  );

  galeria.replaceChildren();

  if (fotos.length === 0) {
    status.textContent = "Ainda não há fotos disponíveis neste evento.";
    return;
  }

  status.textContent = `${fotos.length} foto(s) encontradas.`;

  for (const item of fotos) {
    const { data: publicData } = supabaseClient.storage
      .from(BUCKET)
      .getPublicUrl(`${EVENTO}/${item.name}`);

    const imagem = document.createElement("img");
    imagem.className = "foto";
    imagem.src = publicData.publicUrl;
    imagem.alt = "Foto do evento";
    imagem.loading = "lazy";

    imagem.addEventListener("click", () => {
      fotoAmpliada.src = imagem.src;
      visualizador.classList.add("aberto");
      botaoFechar.focus();
    });

    galeria.appendChild(imagem);
  }
}

function fecharVisualizador() {
  visualizador.classList.remove("aberto");
  fotoAmpliada.removeAttribute("src");
}

botaoFechar.addEventListener("click", fecharVisualizador);

visualizador.addEventListener("click", event => {
  if (event.target === visualizador) {
    fecharVisualizador();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    fecharVisualizador();
  }
});

carregarFotos();

// Atualiza a galeria a cada 30 segundos.
setInterval(carregarFotos, 30000);
