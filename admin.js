const params = new URLSearchParams(window.location.search);
const evento = "default";
 

const nomeEvento = sessionStorage.getItem("evento_nome");
const eventoId = sessionStorage.getItem("evento_id");

const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let todasAsFotos = [];
let fotosSelecionadas = [];
let modoSelecaoAtivo = false;
let indiceZoomAtual = 0;

document.addEventListener("DOMContentLoaded", () => {
  const headerEvento = document.getElementById("evento-nome-header");

  if (headerEvento && nomeEvento) {
    headerEvento.innerText = nomeEvento;
  }

  carregarFotosDoEvento();

  const btnModoSelecao = document.getElementById("btn-modo-selecao");
  const txtModoSelecao = document.getElementById("txt-modo-selecao");
  const iconModoSelecao = document.getElementById("icon-modo-selecao");
  const grupoAcoes = document.getElementById("grupo-acoes-selecao");

  btnModoSelecao?.addEventListener("click", () => {
    modoSelecaoAtivo = !modoSelecaoAtivo;

    if (modoSelecaoAtivo) {
      txtModoSelecao.innerText = "Cancelar Seleção";
      iconModoSelecao.innerText = "✕";
      grupoAcoes.style.display = "flex";
    } else {
      txtModoSelecao.innerText = "Selecionar Fotos";
      iconModoSelecao.innerText = "🔍";
      grupoAcoes.style.display = "none";
      limparSelecaoGeral();
    }
  });

  document
    .getElementById("btn-baixar-zip")
    ?.addEventListener("click", baixarFotosEmZip);
  document
    .getElementById("lightbox-close")
    ?.addEventListener("click", fecharLightbox);
  document
    .getElementById("lightbox-prev")
    ?.addEventListener("click", fotoAnterior);
  document
    .getElementById("lightbox-next")
    ?.addEventListener("click", proximaFoto);

  document.getElementById("openMenuBtn")?.addEventListener("click", () => {
    document.getElementById("menuSidebar").classList.add("menu-active");
  });

  document.getElementById("closeMenuBtn")?.addEventListener("click", () => {
    document.getElementById("menuSidebar").classList.remove("menu-active");
  });
});

async function carregarFotosDoEvento() {
  const grid = document.getElementById("admin-gallery-grid");
  grid.innerHTML = "Carregando...";

  const { data } = await supabaseClient.storage
    .from("fotos-eventos")
    .list(evento);

  if (!data) return;

  todasAsFotos = data.filter((item) => item.name !== ".emptyFolderPlaceholder");

  grid.innerHTML = "";

  todasAsFotos.forEach((item, index) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/fotos-eventos/${evento}/${item.name}`;

    const wrapper = document.createElement("div");
    wrapper.className = "photo-wrapper";

    wrapper.innerHTML = `<img src="${url}">`;

    wrapper.addEventListener("click", () => {
      if (modoSelecaoAtivo) {
        alternarSelecaoFoto(item.name, wrapper);
      } else {
        abrirLightbox(index);
      }
    });

    grid.appendChild(wrapper);
  });
}

function alternarSelecaoFoto(nomeArquivo, elemento) {
  const idx = fotosSelecionadas.indexOf(nomeArquivo);

  if (idx > -1) {
    fotosSelecionadas.splice(idx, 1);
    elemento.classList.remove("item-selecionado");
  } else {
    fotosSelecionadas.push(nomeArquivo);
    elemento.classList.add("item-selecionado");
  }
}

function limparSelecaoGeral() {
  fotosSelecionadas = [];
  document
    .querySelectorAll(".photo-wrapper")
    .forEach((el) => el.classList.remove("item-selecionado"));
}

function abrirLightbox(index) {
  indiceZoomAtual = index;
  document.getElementById("lightbox-modal").style.display = "flex";
  atualizarLightbox();
}

function atualizarLightbox() {
  const item = todasAsFotos[indiceZoomAtual];
  const url = `${SUPABASE_URL}/storage/v1/object/public/fotos-eventos/${evento}/${item.name}`;
  document.getElementById("lightbox-img").src = url;
  document.getElementById("lightbox-counter").innerText =
    `${indiceZoomAtual + 1} / ${todasAsFotos.length}`;
}

function fecharLightbox() {
  document.getElementById("lightbox-modal").style.display = "none";
}

function fotoAnterior() {
  if (indiceZoomAtual > 0) {
    indiceZoomAtual--;
    atualizarLightbox();
  }
}

function proximaFoto() {
  if (indiceZoomAtual < todasAsFotos.length - 1) {
    indiceZoomAtual++;
    atualizarLightbox();
  }
}

async function baixarFotosEmZip() {
  if (fotosSelecionadas.length === 0) {
    alert("Selecione pelo menos uma foto.");
    return;
  }

  const zip = new JSZip();

  const pastaFotos = zip.folder("Memora-Fotos");

  for (const nomeArquivo of fotosSelecionadas) {
    const url = `${SUPABASE_URL}/storage/v1/object/public/fotos-eventos/${evento}/${nomeArquivo}`;

    const resposta = await fetch(url);
    const blob = await resposta.blob();

    pastaFotos.file(nomeArquivo, blob);
  }

  const arquivoZip = await zip.generateAsync({
    type: "blob",
  });

  saveAs(arquivoZip, "Memora-Fotos.zip");
}
