const SUPABASE_URL = "https://rakktbwnybrsvqpbgaid.supabase.co";
const SUPABASE_KEY = "sb_publishable_tLqbug91hIKbyGJHv4V8kA_HbjCmKiL";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);

const formLogin = $("formLogin");
const formCadastro = $("formCadastro");
const formRecuperacao = $("formRecuperacao");
const formNovaSenha = $("formNovaSenha");
const mensagem = $("mensagemConta");

const titulo = $("tituloConta");
const subtitulo = $("subtituloConta");
const abas = $("abasConta");

const URL_CONTA = `${window.location.origin}/conta.html`;
const URL_DASHBOARD = `${window.location.origin}/dashboard.html`;

function mostrarMensagem(texto, tipo = "sucesso") {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
}

function limparMensagem() {
  mensagem.textContent = "";
  mensagem.className = "mensagem";
}

function mostrarFormulario(tipo) {
  limparMensagem();

  formLogin.hidden = tipo !== "login";
  formCadastro.hidden = tipo !== "cadastro";
  formRecuperacao.hidden = tipo !== "recuperacao";
  formNovaSenha.hidden = tipo !== "novaSenha";

  abas.hidden = tipo === "recuperacao" || tipo === "novaSenha";

  $("abaLogin").classList.toggle("ativa", tipo === "login");
  $("abaCadastro").classList.toggle("ativa", tipo === "cadastro");

  if (tipo === "login") {
    titulo.textContent = "Bem-vinda de volta";
    subtitulo.textContent = "Entre para acessar suas memórias.";
  } else if (tipo === "cadastro") {
    titulo.textContent = "Crie sua conta";
    subtitulo.textContent = "Comece a guardar suas memórias.";
  } else if (tipo === "recuperacao") {
    titulo.textContent = "Recuperar senha";
    subtitulo.textContent = "Vamos ajudar você a recuperar o acesso.";
  } else {
    titulo.textContent = "Nova senha";
    subtitulo.textContent = "Escolha uma senha nova para sua conta.";
  }
}

function traduzirErro(erro) {
  const texto = (erro?.message || "").toLowerCase();

  if (texto.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }

  if (texto.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }

  if (texto.includes("user already registered")) {
    return "Este e-mail já possui uma conta. Tente entrar.";
  }

  if (texto.includes("rate limit")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  return (
    erro?.message || "Não foi possível concluir a operação. Tente novamente."
  );
}

$("abaLogin").addEventListener("click", () => mostrarFormulario("login"));
$("abaCadastro").addEventListener("click", () => mostrarFormulario("cadastro"));

$("abrirRecuperacao").addEventListener("click", () => {
  $("emailRecuperacao").value = $("emailLogin").value.trim();
  mostrarFormulario("recuperacao");
});

$("voltarLoginRecuperacao").addEventListener("click", () => {
  mostrarFormulario("login");
});

// CADASTRO
formCadastro.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const nome = $("nomeCadastro").value.trim();
  const email = $("emailCadastro").value.trim();
  const senha = $("senhaCadastro").value;
  const confirmacao = $("confirmarSenha").value;

  if (senha.length < 8) {
    mostrarMensagem("A senha deve ter pelo menos 8 caracteres.", "erro");
    return;
  }

  if (senha !== confirmacao) {
    mostrarMensagem("As senhas não são iguais.", "erro");
    return;
  }

  const botao = formCadastro.querySelector('button[type="submit"]');
  botao.disabled = true;
  botao.textContent = "Criando conta...";

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome },
        emailRedirectTo: `${URL_CONTA}?confirmado=1`,
      },
    });

    if (error) throw error;

    formCadastro.reset();

    if (data.session) {
      mostrarMensagem("Conta criada com sucesso!");
      window.location.assign(URL_DASHBOARD);
    } else {
      mostrarMensagem(
        "Cadastro iniciado. Verifique seu e-mail para confirmar a conta antes de entrar.",
      );
    }
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = "Criar minha conta";
  }
});

// LOGIN
formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const email = $("emailLogin").value.trim();
  const senha = $("senhaLogin").value;
  const botao = formLogin.querySelector('button[type="submit"]');

  botao.disabled = true;
  botao.textContent = "Entrando...";

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) throw error;

   window.location.assign(URL_DASHBOARD);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = "Entrar na minha conta";
  }
});

// SOLICITAR RECUPERAÇÃO
formRecuperacao.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const email = $("emailRecuperacao").value.trim();
  const botao = formRecuperacao.querySelector('button[type="submit"]');

  botao.disabled = true;
  botao.textContent = "Enviando...";

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${URL_CONTA}?modo=redefinir`,
    });

    if (error) throw error;

    formRecuperacao.reset();
    mostrarMensagem(
      "Se houver uma conta com esse e-mail, enviaremos instruções de recuperação. Confira também o spam.",
    );
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = "Enviar link de recuperação";
  }
});

// DEFINIR NOVA SENHA
formNovaSenha.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const senha = $("novaSenha").value;
  const confirmacao = $("confirmarNovaSenha").value;

  if (senha.length < 8) {
    mostrarMensagem("A nova senha deve ter pelo menos 8 caracteres.", "erro");
    return;
  }

  if (senha !== confirmacao) {
    mostrarMensagem("As senhas não são iguais.", "erro");
    return;
  }

  const botao = formNovaSenha.querySelector('button[type="submit"]');
  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    const { data } = await supabaseClient.auth.getSession();

    if (!data.session) {
      throw new Error(
        "O link expirou ou não foi validado. Solicite uma nova recuperação de senha.",
      );
    }

    const { error } = await supabaseClient.auth.updateUser({
      password: senha,
    });

    if (error) throw error;

    await supabaseClient.auth.signOut();
    formNovaSenha.reset();
    mostrarFormulario("login");
    mostrarMensagem("Senha alterada! Entre com sua nova senha.");
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar nova senha";
  }
});

// DETECTAR LINK DE RECUPERAÇÃO
supabaseClient.auth.onAuthStateChange((eventoAuth) => {
  if (eventoAuth === "PASSWORD_RECOVERY") {
    mostrarFormulario("novaSenha");
    mostrarMensagem("Link validado. Cadastre sua nova senha.");
  }
});

const parametros = new URLSearchParams(window.location.search);
const parametrosHash = new URLSearchParams(
  window.location.hash.replace(/^#/, "")
);

if (
  parametros.get("modo") === "redefinir" ||
  parametrosHash.get("type") === "recovery"
) {
  mostrarFormulario("novaSenha");
} else {
  mostrarFormulario("login");

  if (parametros.get("confirmado") === "1") {
    mostrarMensagem(
      "Confirmação recebida. Agora tente entrar com seu e-mail e senha."
    );
  }
}