// Tela de confirmacao dos valores lidos do laudo (antes de gastar creditos).
// O agronomo confere, corrige valor e titulo (lista fechada de campos) e as contas do laboratorio
// sao refeitas a cada alteracao. Contas: lib/validar-laudo.mjs (copia do motor-agronomico, mesmos testes).
import { validarLaudo } from './lib/validar-laudo.mjs';
import { lerNumero, FAIXAS } from './lib/normalizar.mjs';

const CAMPOS = [
  ['argilaPercentual', 'Argila', '%'],
  ['phAgua', 'pH em água', ''],
  ['indiceSmp', 'Índice SMP', ''],
  ['fosforoMgDm3', 'Fósforo (P)', 'mg/dm³'],
  ['potassioMgDm3', 'Potássio (K)', 'mg/dm³'],
  ['potassioCmolcDm3', 'Potássio (K)', 'cmolc/dm³'],
  ['materiaOrganicaPercentual', 'Matéria orgânica', '%'],
  ['carbonoOrganicoPercentual', 'Carbono orgânico', '%'],
  ['calcioCmolcDm3', 'Cálcio (Ca)', 'cmolc/dm³'],
  ['magnesioCmolcDm3', 'Magnésio (Mg)', 'cmolc/dm³'],
  ['alTrocavelCmolcDm3', 'Alumínio trocável (Al)', 'cmolc/dm³'],
  ['hAlCmolcDm3', 'H+Al (acidez potencial)', 'cmolc/dm³'],
  ['somaBasesCmolcDm3', 'Soma de bases (SB)', 'cmolc/dm³'],
  ['ctcEfetivaCmolcDm3', 'CTC efetiva', 'cmolc/dm³'],
  ['ctcPh7CmolcDm3', 'CTC pH 7', 'cmolc/dm³'],
  ['saturacaoBasesPercentual', 'Saturação por bases (V)', '%'],
  ['saturacaoAlPercentual', 'Saturação por Al (m)', '%'],
  ['feOxalatoGDm3', 'Ferro (oxalato)', 'g/dm³'],
  // micronutrientes e enxofre (Tabelas 6.11 e 6.12; nao entram nas contas)
  ['enxofreMgDm3', 'Enxofre (S)', 'mg/dm³'],
  ['zincoMgDm3', 'Zinco (Zn)', 'mg/dm³'],
  ['cobreMgDm3', 'Cobre (Cu)', 'mg/dm³'],
  ['boroMgDm3', 'Boro (B)', 'mg/dm³'],
  ['manganesMgDm3', 'Manganês (Mn)', 'mg/dm³'],
  ['ferroMgDm3', 'Ferro (Fe)', 'mg/dm³'],
  ['sodioMgDm3', 'Sódio (Na)', 'mg/dm³'],
];
// Grupos da tela (micronutrientes recolhidos por padrao)
const GRUPOS = [
  ['acidez', 'Acidez', ['phAgua', 'indiceSmp', 'alTrocavelCmolcDm3', 'hAlCmolcDm3', 'saturacaoAlPercentual', 'saturacaoBasesPercentual']],
  ['fertilidade', 'Fertilidade', ['argilaPercentual', 'materiaOrganicaPercentual', 'carbonoOrganicoPercentual', 'fosforoMgDm3', 'potassioMgDm3',
    'potassioCmolcDm3', 'calcioCmolcDm3', 'magnesioCmolcDm3', 'somaBasesCmolcDm3', 'ctcEfetivaCmolcDm3', 'ctcPh7CmolcDm3']],
  ['micros', 'Micronutrientes e enxofre', ['enxofreMgDm3', 'zincoMgDm3', 'cobreMgDm3', 'boroMgDm3', 'manganesMgDm3', 'ferroMgDm3', 'sodioMgDm3', 'feOxalatoGDm3']],
];
const grupoDe = campo => (GRUPOS.find(([, , cs]) => cs.includes(campo)) || ['outros'])[0];

// Valor diferente do lido no laudo (ou linha adicionada) = editado pelo agronomo
function editado(l) {
  if (!l.original) return Boolean(l.campo || l.texto);
  const n = lerNumero(l.texto);
  if (!n) return true;
  if (n.limite) return !(l.original.limite === n.limite && l.original.limiteValor === n.valor);
  return l.original.valor !== n.valor;
}

const INFO = Object.fromEntries(CAMPOS.map(([k, nome, un]) => [k, { nome, un }]));
const UNIDADE_CONTRATO = { '%': '%', '': 'indice', 'mg/dm³': 'mg/dm3', 'cmolc/dm³': 'cmolc/dm3', 'g/dm³': 'g/dm3' };
const NOMES_CONTA = Object.fromEntries(CAMPOS.map(([k, nome]) => [k, nome]));
NOMES_CONTA.classeTexturalImpressa = 'Classe textural impressa';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const br = v => (typeof v === 'number' ? String(Math.round(v * 10000) / 10000).replace('.', ',') : '');

function linhasDe(laudo) {
  return Object.entries(laudo.campos || {}).filter(([k]) => INFO[k]).map(([k, c]) => ({
    campo: k,
    texto: c.valor === null && c.limite ? (c.textoOriginal || `<${br(c.limiteValor)}`) : br(c.valor),
    lido: (c.textoOriginal !== undefined ? `${c.rotuloImpresso ? c.rotuloImpresso + ': ' : ''}${c.textoOriginal}` : (c.origem === 'calculado' ? `calculado: ${c.regra || ''}` : ''))
      + (c.metodoTexto ? ` (${c.metodoTexto})` : ''),
    original: c,
  }));
}

function montarLaudo(base, linhas, camadaCm) {
  const campos = {};
  const erros = [];
  const usados = new Set();
  for (const l of linhas) {
    if (!l.campo) continue;
    if (usados.has(l.campo)) { erros.push(`${INFO[l.campo].nome} aparece duas vezes.`); continue; }
    usados.add(l.campo);
    const n = lerNumero(l.texto);
    const pagina = l.original?.pagina ?? 1;
    const unidade = l.campo === 'phAgua' ? 'pH' : UNIDADE_CONTRATO[INFO[l.campo].un];
    const extra = { ...(l.original?.metodo !== undefined ? { metodo: l.original.metodo } : {}),
      ...(l.original?.metodoTexto ? { metodoTexto: l.original.metodoTexto } : {}),
      ...(l.original?.textoOriginal !== undefined ? { textoOriginal: l.original.textoOriginal } : {}) };
    if (!n) { erros.push(`${INFO[l.campo].nome}: valor "${l.texto}" não é um número.`); continue; }
    if (n.limite) { campos[l.campo] = { valor: null, limite: n.limite, limiteValor: n.valor, unidade, pagina, ...extra }; continue; }
    const [min, max] = FAIXAS[l.campo] ?? [0, Infinity];
    if (n.valor < min || n.valor > max) erros.push(`${INFO[l.campo].nome}: ${br(n.valor)} fora da faixa plausível (${br(min)} a ${br(max)}).`);
    const editado = !l.original || l.original.valor !== n.valor;
    campos[l.campo] = { valor: n.valor, unidade, pagina, ...extra, ...(editado ? { editado: true } : {}) };
  }
  for (const k of ['argilaPercentual', 'fosforoMgDm3', 'potassioMgDm3', 'ctcPh7CmolcDm3']) {
    if (!campos[k]) erros.push(`${INFO[k].nome} é obrigatório para interpretar P e K.`);
  }
  const laudo = { ...base, camadaCm: camadaCm || null, campos };
  delete laudo.problemas;
  return { laudo, erros };
}

function opcoesCampo(atual) {
  return '<option value="">— escolha —</option>' + CAMPOS.map(([k, nome, un]) =>
    `<option value="${k}"${k === atual ? ' selected' : ''}>${esc(nome)}${un ? ' (' + esc(un) + ')' : ''}</option>`).join('');
}

/**
 * Abre a tela. dados = resposta do webhook soloia-ler. Chama onConfirmar({ laudo, llamaJobId }) ou onVoltar().
 */
export function abrir(el, dados, { onConfirmar, onVoltar, custo = 16, cultura = '' }) {
  let indice = 0;
  let microsAberto = false;
  let linhas = [];
  let camada = null;

  function carregarAmostra(i) {
    indice = i;
    const a = dados.amostras[i];
    linhas = linhasDe(a.laudo);
    camada = a.laudo.camadaCm || '';
    render();
  }

  function atual() {
    return montarLaudo(dados.amostras[indice].laudo, linhas, camada);
  }

  // Dados opcionais da lavoura -> personalizacao do motor (personalizacao.mjs valida de novo no servidor)
  function lerLavoura() {
    const v = id => el.querySelector('#' + id)?.value || '';
    const saida = {};
    const rend = v('lvRend').trim();
    if (rend) {
      const n = lerNumero(rend);
      if (!n || n.limite || !(n.valor > 0)) { el.querySelector('.cf-dica').textContent = 'Produtividade inválida.'; el.querySelector('.cf-lavoura').open = true; return null; }
      saida.rendimentoTHa = n.valor;
    }
    if (v('lvSistema')) saida.sistema = v('lvSistema');
    if (v('lvCultivo')) saida.cultivoAposAnalise = Number(v('lvCultivo'));
    if (v('lvAntec')) saida.culturaAntecedente = v('lvAntec');
    if (v('lvExpect')) saida.expectativaResposta = v('lvExpect');
    return saida;
  }

  function renderContas() {
    const { laudo, erros } = atual();
    const v = validarLaudo(laudo);
    const item = c => `<li class="conta ${c.ok ? 'ok' : 'falha'}">${c.ok ? '✓' : '✗'} ${esc(c.nome)}: calculado ${br(c.calculado)} · laudo ${br(c.impresso)}</li>`;
    const falhas = v.contas.filter(c => !c.ok);
    // resumo curto; lista completa recolhida
    const itens = !v.contas.length ? '' : (falhas.length
      ? `<p class="cf-resumo falha">✗ ${falhas.length} de ${v.contas.length} contas do laboratório não fecham:</p><ul>${falhas.map(item).join('')}</ul>`
      : `<p class="cf-resumo ok">✓ As ${v.contas.length} contas do laboratório fecham.</p>`)
      + `<details class="cf-todas"><summary>ver todas as contas</summary><ul>${v.contas.map(item).join('')}</ul></details>`;
    const problemas = [
      ...erros.map(e => ({ nivel: 'bloqueio', texto: e })),
      ...v.problemas.filter(p => p.conta).map(p => ({ nivel: p.nivel, texto: `${p.conta} não fecha${p.suspeitos?.length ? ' — confira: ' + p.suspeitos.map(s => NOMES_CONTA[s] || s).join(', ') : ''}.` })),
      ...v.problemas.filter(p => !p.conta && p.nivel === 'aviso').map(p => ({ nivel: 'aviso', texto: `${NOMES_CONTA[p.campo] || p.campo}: ausente no laudo; parte do relatório fica pendente.` })),
    ];
    const todasAbertas = el.querySelector('.cf-todas')?.open;
    el.querySelector('.cf-contas').innerHTML = (itens ? itens : '<p class="muted">O laudo não traz dados suficientes para refazer as contas; confira os valores com atenção.</p>')
      + problemas.map(p => `<div class="cf-prob ${p.nivel}">${p.nivel === 'bloqueio' ? '⚠️' : 'ℹ️'} ${esc(p.texto)}</div>`).join('');
    if (todasAbertas) el.querySelector('.cf-todas').open = true;
    const suspeitos = new Set(v.problemas.filter(p => p.conta).flatMap(p => p.suspeitos || []));
    el.querySelectorAll('.cf-row').forEach((row) => {
      const l = linhas[Number(row.dataset.i)];
      row.classList.toggle('suspeito', Boolean(l && suspeitos.has(l.campo)));
      row.classList.toggle('editado', Boolean(l && editado(l)));
    });
    const invalido = erros.length > 0;
    const conferiu = el.querySelector('#cfConferi').checked;
    const btn = el.querySelector('#cfConfirmar');
    btn.disabled = invalido || !conferiu;
    el.querySelector('.cf-dica').textContent = invalido ? 'Corrija os valores marcados para continuar.'
      : !conferiu ? 'Marque que conferiu os valores com o PDF para continuar.' : '';
  }

  function render() {
    const lav = ['lvRend', 'lvSistema', 'lvCultivo', 'lvAntec', 'lvExpect'].map(id => [id, el.querySelector('#' + id)?.value]);
    const aberto = el.querySelector('.cf-lavoura')?.open;
    const a = dados.amostras[indice];
    const seletor = dados.amostras.length > 1 ? `
      <div class="cf-linha-topo"><label for="cfAmostra">Amostra</label>
        <select id="cfAmostra">${dados.amostras.map((x, i) => `<option value="${i}"${i === indice ? ' selected' : ''}>${esc(x.laudo.amostra)}${x.laudo.identificacao ? ' — ' + esc(x.laudo.identificacao) : ''}</option>`).join('')}</select></div>` : '';
    el.innerHTML = `
      <h2>Confira os valores lidos do laudo</h2>
      <p class="muted cf-sub">${esc(dados.laboratorio || 'Laboratório não identificado')}${dados.localizacao ? ' · ' + esc(dados.localizacao) : ''}. Corrija qualquer valor ou título lido errado antes de gerar a interpretação.</p>
      ${seletor}
      <div class="cf-linha-topo"><label for="cfCamada">Profundidade da amostra</label>
        <select id="cfCamada">
          <option value="">Não informada no laudo</option>
          ${['0-10', '0-20', '10-20', '0-5'].map(c => `<option value="${c}"${c === camada ? ' selected' : ''}>${c} cm</option>`).join('')}
        </select></div>
      <div class="cf-tabela" role="table">
        <div class="cf-cab" role="row"><span>Campo</span><span>Valor</span><span>Lido no laudo</span><span></span></div>
        ${[...GRUPOS, ['outros', 'Adicionados', []]].map(([g, titulo]) => {
          const doGrupo = linhas.map((l, i) => [l, i]).filter(([l]) => grupoDe(l.campo) === g);
          if (!doGrupo.length) return '';
          const html = doGrupo.map(([l, i]) => `
          <div class="cf-row${editado(l) ? ' editado' : ''}" role="row" data-i="${i}">
            <select class="cf-campo" aria-label="Campo">${opcoesCampo(l.campo)}</select>
            <div class="cf-valor"><input class="cf-num" inputmode="decimal" value="${esc(l.texto)}" aria-label="Valor"><span class="cf-un">${esc(INFO[l.campo]?.un ?? '')}</span></div>
            <span class="cf-lido" title="${esc(l.lido)}">${esc(l.lido || '—')}</span>
            <button type="button" class="cf-remover" aria-label="Remover linha">×</button>
          </div>`).join('');
          if (g === 'micros') return `<details class="cf-grupo"${microsAberto ? ' open' : ''}><summary>${titulo} (${doGrupo.length})</summary>${html}</details>`;
          return `<div class="cf-grupo-tit">${titulo}</div>${html}`;
        }).join('')}
      </div>
      <div class="cf-legenda"><span class="par"><span class="leg editado"></span> valor editado por você</span><span class="par"><span class="leg suspeito"></span> entra numa conta que não fechou</span></div>
      <button type="button" class="cf-add">+ adicionar valor</button>
      <div class="cf-contas" aria-live="polite"></div>
      <details class="cf-lavoura">
        <summary>Dados da lavoura (opcional)</summary>
        <p class="muted" style="font-size:13px">Sem estes dados, o relatório mostra os cenários do manual para cada opção.</p>
        <div class="cf-lav-grid">
          <label>Produtividade esperada (t/ha)<input id="lvRend" inputmode="decimal" placeholder="Referência do manual"></label>
          <label>Sistema de manejo<select id="lvSistema">${cultura === 'arroz-irrigado'
            ? '<option value="">Não informado</option><option value="arroz_solo_seco">Semeadura em solo seco</option><option value="arroz_pre_germinado">Pré-germinado ou transplante</option>'
            : '<option value="">Não informado</option><option value="convencional">Convencional</option><option value="plantio_direto_implantacao">Plantio direto em implantação</option><option value="plantio_direto_consolidado">Plantio direto consolidado</option>'}</select></label>
          ${cultura === 'arroz-irrigado'
            ? '<label>Expectativa de resposta à adubação<select id="lvExpect"><option value="">Não informada</option><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="muito_alta">Muito alta</option></select></label>'
            : `<label>Cultivo após a análise<select id="lvCultivo"><option value="">1º cultivo (padrão)</option><option value="1">1º cultivo</option><option value="2">2º cultivo</option></select></label>
          <label>Cultura antecedente<select id="lvAntec"><option value="">Não informada</option><option value="leguminosa">Leguminosa</option><option value="consorciacao_pousio">Consorciação ou pousio</option><option value="graminea">Gramínea</option></select></label>`}
        </div>
      </details>
      <label class="cf-conferi"><input id="cfConferi" type="checkbox"> Conferi os valores com o PDF do laudo.</label>
      <div class="cf-dica muted"></div>
      <div class="actions">
        <button type="button" class="cf-voltar">Voltar</button>
        <button type="button" id="cfConfirmar">Confirmar e gerar interpretação (${custo} créditos)</button>
      </div>`;
    el.querySelector('#cfAmostra')?.addEventListener('change', e => carregarAmostra(Number(e.target.value)));
    el.querySelector('.cf-grupo')?.addEventListener('toggle', e => { microsAberto = e.target.open; });
    el.querySelector('#cfCamada').addEventListener('change', e => { camada = e.target.value; renderContas(); });
    el.querySelectorAll('.cf-row').forEach((row) => {
      const i = Number(row.dataset.i);
      row.querySelector('.cf-campo').addEventListener('change', (e) => {
        linhas[i].campo = e.target.value;
        row.querySelector('.cf-un').textContent = INFO[e.target.value]?.un ?? '';
        renderContas();
      });
      row.querySelector('.cf-num').addEventListener('input', (e) => { linhas[i].texto = e.target.value; renderContas(); });
      row.querySelector('.cf-remover').addEventListener('click', () => { linhas.splice(i, 1); render(); });
    });
    el.querySelector('.cf-add').addEventListener('click', () => { linhas.push({ campo: '', texto: '', lido: '', original: null }); render(); });
    el.querySelector('#cfConferi').addEventListener('change', renderContas);
    el.querySelector('.cf-voltar').addEventListener('click', () => onVoltar());
    el.querySelector('#cfConfirmar').addEventListener('click', () => {
      const { laudo, erros } = atual();
      if (erros.length) return;
      const personalizacao = lerLavoura();
      if (personalizacao === null) return;
      onConfirmar({ laudo, llamaJobId: dados.llamaJobId, validacao: validarLaudo(laudo), personalizacao });
    });
    for (const [id, valor] of lav) { const c = el.querySelector('#' + id); if (c && valor) c.value = valor; }
    if (aberto) el.querySelector('.cf-lavoura').open = true;
    renderContas();
  }

  el.hidden = false;
  carregarAmostra(0);
}

window.SoloiaConfirmacao = { abrir };
