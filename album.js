const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const params = new URLSearchParams(window.location.search);
const evento = params.get("evento") || "default";

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // MENU SIDEBAR
  // =========================
  const menuSidebar = document.getElementById("menuSidebar");
  const menuOverlay = document.getElementById("menuOverlay");
  const openMenuBtn = document.getElementById("openMenuBtn");
  const closeMenuBtn = document.getElementById("closeMenuBtn");

  if (openMenuBtn && closeMenuBtn && menuSidebar) {
    openMenuBtn.addEventListener("click", () => {
      menuSidebar.classList.add("menu-active");
      if (menuOverlay) menuOverlay.classList.add("active");
    });

    closeMenuBtn.addEventListener("click", () => {
      menuSidebar.classList.remove("menu-active");
      if (menuOverlay) menuOverlay.classList.remove("active");
    });

    if (menuOverlay) {
      menuOverlay.addEventListener("click", () => {
        menuSidebar.classList.remove("menu-active");
        menuOverlay.classList.remove("active");
      });
    }
  }

  // =========================
  // ELEMENTOS
  // =========================
  const fileInput = document.getElementById("cameraInput");
  const dropZone = document.getElementById("dropZone");
  const cameraOnlyInput = document.getElementById("cameraOnlyInput");
  const btnCamera = document.getElementById("btn-camera");
  const previewGrid = document.getElementById("previewGrid");
  const btnEnviar = document.getElementById("btn-enviar-fotos");
  const limparFotos = document.getElementById("limparFotos");
  const contadorSelecionadas = document.querySelector(".selected-header span");

  let arquivosParaUpload = [];

  if (!fileInput || !dropZone || !previewGrid || !btnEnviar) {
    console.error("Elementos da página album não encontrados.");
    return;
  }

  // =========================
  // ABRIR SELETOR
  // =========================
  dropZone.addEventListener("click", (e) => {
  if (e.target.id !== "btn-camera") {
    fileInput.click();
  }
});


if (btnCamera && cameraOnlyInput) {
  btnCamera.addEventListener("click", (e) => {
    e.stopPropagation();
    cameraOnlyInput.click();
  });
}

  fileInput.addEventListener("change", (e) => {
    arquivosParaUpload = Array.from(e.target.files);
    exibirPreviews();
  });

  cameraOnlyInput.addEventListener("change", (e) => {
  arquivosParaUpload = Array.from(e.target.files);
  exibirPreviews();
});

  // =========================
  // PREVIEWS
  // =========================
  function exibirPreviews() {
    previewGrid.innerHTML = "";

    arquivosParaUpload.forEach((file) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = document.createElement("img");

        img.src = e.target.result;
        img.className = "preview-item";

        previewGrid.appendChild(img);
      };

      reader.readAsDataURL(file);
    });

    if (contadorSelecionadas) {
      contadorSelecionadas.textContent = `Selecionadas (${arquivosParaUpload.length})`;
    }
  }

  // =========================
  // LIMPAR
  // =========================
  if (limparFotos) {
    limparFotos.addEventListener("click", () => {
      arquivosParaUpload = [];
      previewGrid.innerHTML = "";
      fileInput.value = "";

      if (contadorSelecionadas) {
        contadorSelecionadas.textContent = "Selecionadas (0)";
      }
    });
  }

  // =========================
  // UPLOAD
  // =========================
  btnEnviar.addEventListener("click", async () => {
    if (!arquivosParaUpload.length) {
      alert("Selecione fotos primeiro.");
      return;
    }

    btnEnviar.disabled = true;
    btnEnviar.innerText = "ENVIANDO...";

    try {
      for (const file of arquivosParaUpload) {
        const nome = `${Date.now()}_${file.name}`;

        const { error } = await client.storage
          .from("fotos-eventos")
          .upload(`${evento}/${nome}`, file);

        if (error) throw error;
      }

      alert("Fotos enviadas com sucesso!");
      window.location.href = `galeria.html?evento=${evento}`;
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar fotos.");
      btnEnviar.disabled = false;
      btnEnviar.innerText = "ENVIAR FOTOS";
    }
  });
});
