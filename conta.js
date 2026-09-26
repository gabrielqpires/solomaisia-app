// Conta fora do Wix: login com Google pelo Supabase Auth.
// O n8n (webhook soloia-sessao) confere o token e devolve a mesma assinatura memberId|email|exp que o
// backend do Wix gerava; o resto do app (leitura, SOLO+IA, estorno) nao muda.
// Dentro do iframe do Wix este modulo nao e usado (a auth continua vindo por postMessage).
(function () {
  const SUPABASE_URL = 'https://gsnqwkftpdabiyottgmg.supabase.co';
  // chave publica (anon): pode ficar no site; o que protege os dados sao as regras (RLS) do banco
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzbnF3a2Z0cGRhYml5b3R0Z21nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDQxNzIsImV4cCI6MjA3MzAyMDE3Mn0.1cKySweAG8fSJ6ykjltLHr9Dg0nhq_bO3MIjlsmcjU8';
  const SESSAO_URL = 'https://n8nls.solomaisia.com.br/webhook/soloia-sessao';
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js';
  const DESLOGADO = { isLogged: false, memberId: null, email: null, creditos: null, upload: null };

  let cliente = null;
  let cache = null; // { token, auth }

  function carregarLib() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = LIB;
      s.onload = ok;
      s.onerror = () => falha(new Error('Não foi possível carregar o login.'));
      document.head.appendChild(s);
    });
  }

  async function cli() {
    if (!cliente) {
      await carregarLib();
      cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      });
    }
    return cliente;
  }

  async function sessaoSupabase() {
    const c = await cli();
    const { data } = await c.auth.getSession();
    return data?.session || null;
  }

  // Mesmo formato do askAuth do Wix: { isLogged, memberId, email, creditos, upload:{memberId,email,exp,sig} }
  // a pagina pede a sessao em dois lugares ao carregar: uma chamada so ao n8n
  let pendente = null;
  function sessao(opcoes) {
    if (!pendente) pendente = buscarSessao(opcoes).finally(() => { pendente = null; });
    return pendente;
  }

  async function buscarSessao({ forcar = false } = {}) {
    try {
      const s = await sessaoSupabase();
      if (!s) { cache = null; return DESLOGADO; }
      if (!forcar && cache && cache.token === s.access_token && cache.auth.upload?.exp > Date.now() + 5 * 60 * 1000) return cache.auth;
      // form-urlencoded: requisicao simples, sem preflight de CORS
      const resp = await fetch(SESSAO_URL, { method: 'POST', body: new URLSearchParams({ token: s.access_token }) });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok || !d.ok || !d.upload?.sig) return { ...DESLOGADO, email: s.user?.email || null };
      const meta = s.user?.user_metadata || {};
      const auth = { isLogged: true, memberId: d.memberId, email: d.email, creditos: Number(d.creditos) || 0, upload: d.upload,
        nome: meta.full_name || meta.name || null, foto: meta.avatar_url || meta.picture || null };
      cache = { token: s.access_token, auth };
      return auth;
    } catch (e) {
      console.error('[Solo+IA] sessao:', e);
      return DESLOGADO;
    }
  }

  async function entrar() {
    const c = await cli();
    await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  }

  async function sair() {
    try { await (await cli()).auth.signOut(); } catch (_) {}
    cache = null;
    location.reload();
  }

  async function salvar({ fileName, culture, text, amostra }) {
    if (!text) return;
    try {
      if (!(await sessaoSupabase())) return;
      const { error } = await cliente.from('interpretacoes').insert({ cultura: culture || null, arquivo: fileName || null, amostra: amostra || null, texto: text });
      if (error) console.error('[Solo+IA] salvar historico:', error);
    } catch (e) { console.error('[Solo+IA] salvar historico:', e); }
  }

  async function listar() {
    const c = await cli();
    const { data, error } = await c.from('interpretacoes').select('id, criado_em, cultura, arquivo, amostra').order('criado_em', { ascending: false }).limit(200);
    if (error) throw error;
    return data || [];
  }

  async function abrir(id) {
    const c = await cli();
    const { data, error } = await c.from('interpretacoes').select('id, criado_em, cultura, arquivo, amostra, texto').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function apagar(id) {
    const c = await cli();
    const { error } = await c.from('interpretacoes').delete().eq('id', id);
    if (error) throw error;
  }

  // Compra de creditos: o n8n cria o link do Mercado Pago (soloia-pagamento, confere a assinatura da sessao)
  // e o fluxo "COMPRA DE CRÉDITOS" (soloia-create-payment) espera o pagamento e credita.
  const PAGAMENTO_URL = 'https://n8nls.solomaisia.com.br/webhook/soloia-pagamento';
  const CONFIRMAR_URL = 'https://n8nls.solomaisia.com.br/webhook/soloia-create-payment';

  async function criarPagamento(packageId) {
    const a = await sessao();
    if (!a.isLogged || !a.upload?.sig) throw new Error('login');
    const u = a.upload;
    const resp = await fetch(PAGAMENTO_URL, { method: 'POST', body: new URLSearchParams({
      memberId: u.memberId, email: u.email || '', exp: String(u.exp), sig: u.sig, packageId, volta: location.origin }) });
    const d = await resp.json().catch(() => ({}));
    if (!d.ok || !d.url) throw new Error(d.motivo || 'falha');
    return { url: d.url, externalRef: d.externalRef, packageId: d.packageId, memberId: u.memberId };
  }

  // Resposta: 'approved' | 'rejected' | '' (conexao caiu; o n8n continua conferindo e credita mesmo assim)
  async function confirmarPagamento({ memberId, packageId, externalRef }) {
    try {
      const resp = await fetch(CONFIRMAR_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, packageId, externalRef }), keepalive: true });
      const d = await resp.json().catch(() => ({}));
      return String(d.status || '').toLowerCase();
    } catch (_) { return ''; }
  }

  window.SoloiaConta = { sessao, entrar, sair, salvar, listar, abrir, apagar, criarPagamento, confirmarPagamento };
})();
