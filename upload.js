document.addEventListener("DOMContentLoaded", () => {
  const openMenuBtn = document.getElementById("openMenuBtn");
  const closeMenuBtn = document.getElementById("closeMenuBtn");
  const menuSidebar = document.getElementById("menuSidebar");
  const menuOverlay = document.getElementById("menuOverlay");

  if (openMenuBtn && menuSidebar) {
    openMenuBtn.addEventListener("click", () => {
      menuSidebar.classList.add("menu-active");
      if (menuOverlay) menuOverlay.classList.add("active");
    });
  }

  if (closeMenuBtn && menuSidebar) {
    closeMenuBtn.addEventListener("click", () => {
      menuSidebar.classList.remove("menu-active");
      if (menuOverlay) menuOverlay.classList.remove("active");
    });
  }

  if (menuOverlay) {
    menuOverlay.addEventListener("click", () => {
      if (menuSidebar) menuSidebar.classList.remove("menu-active");
      menuOverlay.classList.remove("active");
    });
  }

  const btnEnviar = document.getElementById("btn-enviar-fotos");
  if (btnEnviar) {
    btnEnviar.addEventListener("click", () => {
      const url = new URL("album.html", window.location.href);
      const params = new URLSearchParams(window.location.search);
      url.searchParams.set("evento", params.get("evento") || "default");
      if (params.get("eventoId")) url.searchParams.set("eventoId", params.get("eventoId"));
      if (params.get("preview") === "1") url.searchParams.set("preview", "1");
      window.location.href = url.href;
    });
  }

  const btnGaleria = document.getElementById("btn-ver-galeria");
  if (btnGaleria) {
    btnGaleria.addEventListener("click", () => {
      const url = new URL("galeria.html", window.location.href);
      const params = new URLSearchParams(window.location.search);
      url.searchParams.set("evento", params.get("evento") || "default");
      if (params.get("eventoId")) url.searchParams.set("eventoId", params.get("eventoId"));
      if (params.get("preview") === "1") url.searchParams.set("preview", "1");
      window.location.href = url.href;
    });
  }
});
