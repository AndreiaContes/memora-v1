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
      window.location.href = "album.html?evento=default";
    });
  }

  const btnGaleria = document.getElementById("btn-ver-galeria");
  if (btnGaleria) {
    btnGaleria.addEventListener("click", () => {
      window.location.href = "galeria.html?evento=default";
    });
  }
});
