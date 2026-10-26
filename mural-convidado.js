
const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";

// Copie a chave publicável do seu conta.js.
// Não use uma chave service_role ou secreta.
const MURAL_SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";

const muralClient = window.supabase.createClient(
  SUPABASE_URL,
  MURAL_SUPABASE_KEY
);

// O mesmo link/QR Code deverá informar o identificador do evento.
const parametrosMural = new URLSearchParams(window.location.search);
const EVENTO_ID_MURAL = parametrosMural.get("eventoId");

const formularioMural = document.getElementById("formMuralConvidado");
const campoNomeMural = document.getElementById("nomeRecado");
const campoMensagemMural = document.getElementById("mensagemRecado");
const contadorMural = document.getElementById("contadorMensagem");
const statusMural = document.getElementById("statusMural");
const botaoEnviarMural = document.getElementById("enviarRecado");

function mostrarStatusMural(texto, erro = false) {
  if (!statusMural) return;

  statusMural.textContent = texto;
  statusMural.style.color = erro ? "#ffb6ad" : "#d8bd82";
}

if (!formularioMural) {
  console.error(
    "Formulário do mural não encontrado. Confira os IDs no album.html."
  );
} else if (
  !campoNomeMural ||
  !campoMensagemMural ||
  !statusMural ||
  !botaoEnviarMural
) {
  console.error(
    "Faltam elementos do formulário do mural no album.html."
  );
} else if (!EVENTO_ID_MURAL) {
  mostrarStatusMural(
    "O link deste evento está incompleto. Abra o formulário pelo QR Code correto.",
    true
  );
  botaoEnviarMural.disabled = true;
} else {
  campoMensagemMural.addEventListener("input", () => {
    if (contadorMural) {
      contadorMural.textContent =
        `${campoMensagemMural.value.length} / 1000`;
    }
  });

  formularioMural.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = campoNomeMural.value.trim();
    const mensagem = campoMensagemMural.value.trim();

    if (nome.length < 2 || nome.length > 80) {
      mostrarStatusMural(
        "Digite seu nome com pelo menos 2 caracteres e no máximo 80.",
        true
      );
      return;
    }

    if (mensagem.length < 3 || mensagem.length > 1000) {
      mostrarStatusMural(
        "A mensagem deve ter entre 3 e 1000 caracteres.",
        true
      );
      return;
    }

    botaoEnviarMural.disabled = true;
    mostrarStatusMural("Enviando seu recado...");

    try {
      const { error } = await muralClient
        .from("mural_mensagens")
        .insert({
          evento_id: EVENTO_ID_MURAL,
          nome,
          mensagem
        });

      if (error) throw error;

      formularioMural.reset();

      if (contadorMural) {
        contadorMural.textContent = "0 / 1000";
      }

      mostrarStatusMural(
        "Recado enviado com sucesso! Ele ficará aguardando aprovação do responsável pelo evento."
      );
    } catch (error) {
      console.error("Erro ao enviar recado:", error);

      mostrarStatusMural(
        "Não foi possível enviar o recado. Verifique a conexão e tente novamente.",
        true
      );
    } finally {
      botaoEnviarMural.disabled = false;
    }
  });
}
