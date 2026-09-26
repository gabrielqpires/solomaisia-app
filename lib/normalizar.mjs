// Saida do agente extrator (valores impressos como texto) -> contrato do laudo (CONTRATO-LAUDO.md), uma amostra por laudo.
// Toda conversao numerica e de unidade acontece aqui, por codigo, com a origem registrada.

const DESTINO = {
  argila: ['argilaPercentual', 'percentual'],
  ph_agua: ['phAgua', 'ph'],
  indice_smp: ['indiceSmp', 'indice'],
  fosforo: ['fosforoMgDm3', 'mg'],
  potassio: ['potassioMgDm3', 'mg'],
  potassio_cmolc: ['potassioCmolcDm3', 'cmolc'],
  materia_organica: ['materiaOrganicaPercentual', 'percentual'],
  carbono_organico: ['carbonoOrganicoPercentual', 'percentual'],
  aluminio: ['alTrocavelCmolcDm3', 'cmolc'],
  calcio: ['calcioCmolcDm3', 'cmolc'],
  magnesio: ['magnesioCmolcDm3', 'cmolc'],
  h_al: ['hAlCmolcDm3', 'cmolc'],
  soma_bases: ['somaBasesCmolcDm3', 'cmolc'],
  ctc_efetiva: ['ctcEfetivaCmolcDm3', 'cmolc'],
  ctc_ph7: ['ctcPh7CmolcDm3', 'cmolc'],
  saturacao_bases: ['saturacaoBasesPercentual', 'percentual'],
  saturacao_al: ['saturacaoAlPercentual', 'percentual'],
  ferro_oxalato: ['feOxalatoGDm3', 'g_dm3'],
};

const ROTULO_UNIDADE = { percentual: '%', ph: 'pH', indice: 'indice', mg: 'mg/dm3', cmolc: 'cmolc/dm3', g_dm3: 'g/dm3' };

// Faixas plausiveis na unidade do contrato: fora delas o valor e rejeitado (erro de leitura ou de coluna).
export const FAIXAS = {
  argilaPercentual: [0, 100], phAgua: [3, 9], indiceSmp: [4, 7.5], fosforoMgDm3: [0, 800], potassioMgDm3: [0, 2500],
  potassioCmolcDm3: [0, 6], materiaOrganicaPercentual: [0, 25], carbonoOrganicoPercentual: [0, 15],
  alTrocavelCmolcDm3: [0, 15], calcioCmolcDm3: [0, 40], magnesioCmolcDm3: [0, 20], hAlCmolcDm3: [0, 60],
  somaBasesCmolcDm3: [0, 60], ctcEfetivaCmolcDm3: [0, 60], ctcPh7CmolcDm3: [0.5, 80],
  saturacaoBasesPercentual: [0, 100], saturacaoAlPercentual: [0, 100], feOxalatoGDm3: [0, 50],
};

// Campos que entram em alguma conta do motor; erro nos demais vira aviso, nao bloqueio.
export const USADOS_PELO_MOTOR = new Set(['argilaPercentual', 'ctcPh7CmolcDm3', 'fosforoMgDm3', 'potassioMgDm3', 'phAgua',
  'indiceSmp', 'materiaOrganicaPercentual', 'saturacaoBasesPercentual', 'saturacaoAlPercentual', 'alTrocavelCmolcDm3',
  'calcioCmolcDm3', 'magnesioCmolcDm3', 'feOxalatoGDm3']);

function canonUnidade(u) {
  if (u === null || u === undefined) return null;
  return String(u).toLowerCase().replace(/<[^>]+>/g, '').replace(/[\s.]/g, '')
    .replace(/⁻³|-3|³|\^3/g, '3').replace(/\(c\)/g, 'c').replace(/[()]/g, '').replace(/-+$/g, '');
}

// fator para levar a unidade impressa a unidade do contrato; undefined = unidade nao reconhecida
function fatorUnidade(tipo, unidade) {
  const u = canonUnidade(unidade);
  if (u === null || u === '' || u === '-') return undefined;
  const tabela = {
    percentual: { '%': 1, '%m/v': 1, 'm/v': 1, 'g/kg': 0.1, 'g/dm3': 0.1, 'dag/kg': 1, 'dag/dm3': 1 },
    mg: { 'mg/dm3': 1, 'mgdm3': 1, 'mg/l': 1, 'ppm': 1, 'mg/kg': undefined },
    cmolc: { 'cmolc/dm3': 1, 'cmolcdm3': 1, 'cmolc/l': 1, 'cmol/dm3': 1, 'cmolcl': 1, 'meq/100ml': 1, 'meq/100cm3': 1,
      'meq/dl': 1, 'mmolc/dm3': 0.1, 'mmolcdm3': 0.1 },
    g_dm3: { 'g/dm3': 1, 'mg/dm3': 0.001, 'mg/kg': undefined },
    ph: {}, indice: {},
  }[tipo];
  return tabela[u];
}

export function lerNumero(texto) {
  const t = String(texto).trim().replace(/\s/g, '');
  const m = /^([<>]=?|≤|≥)?(-?[\d.,]+)$/.exec(t);
  if (!m) return null;
  let n = m[2];
  if (n.includes(',') && n.includes('.')) n = n.replace(/\./g, '').replace(',', '.');
  else n = n.replace(',', '.');
  const valor = Number(n);
  if (!Number.isFinite(valor)) return null;
  return { valor, limite: m[1] ? (m[1].startsWith('<') || m[1] === '≤' ? 'abaixo' : 'acima') : null };
}

export function ufDe(localizacao) {
  if (!localizacao) return null;
  const t = localizacao.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\brs\b|rio grande do sul/.test(t)) return 'RS';
  if (/\bsc\b|santa catarina/.test(t)) return 'SC';
  return null;
}

export function metodoPK(texto) {
  if (!texto) return null;
  if (/mehlich\s*[-–]?\s*(3|iii)\b/i.test(texto)) return 'mehlich_3';
  if (/mehlich\s*[-–]?\s*(1|i)\b/i.test(texto)) return 'mehlich_1';
  return null;
}

export function camadaDe(profundidade) {
  const m = /(\d+)\s*(?:-|–|a|até|ate)\s*(\d+)/i.exec(profundidade ?? '');
  return m ? `${Number(m[1])}-${Number(m[2])}` : null;
}

/** Converte uma amostra da saida do extrator em laudo do contrato. Retorna { laudo, problemas }. */
export function amostraParaLaudo(extraido, amostra) {
  const problemas = [];
  const campos = {};
  const extras = {};
  for (const v of amostra.valores) {
    if (v.campo === 'classe_textural') { extras.classeTextural = v.textoValor.replace(/\D/g, '') || null; continue; }
    const [nome, tipo] = DESTINO[v.campo] ?? [];
    if (!nome) { problemas.push({ nivel: 'aviso', campo: v.campo, motivo: 'campo desconhecido ignorado' }); continue; }
    if (campos[nome]) { problemas.push({ nivel: 'bloqueio', campo: nome, motivo: `campo repetido na amostra (${campos[nome].textoOriginal} e ${v.textoValor})` }); continue; }
    const lido = lerNumero(v.textoValor);
    const base = { unidade: ROTULO_UNIDADE[tipo], pagina: v.pagina, textoOriginal: v.textoValor, rotuloImpresso: v.rotuloImpresso };
    if (!lido) { problemas.push({ nivel: 'aviso', campo: nome, motivo: `valor nao numerico: "${v.textoValor}"` }); continue; }
    if (lido.limite) {
      // abaixo/acima do limite de quantificacao: nunca vira zero no contrato
      campos[nome] = { ...base, valor: null, limite: lido.limite, limiteValor: lido.valor };
      continue;
    }
    let fator = ['ph', 'indice'].includes(tipo) ? 1 : fatorUnidade(tipo, v.unidadeImpressa);
    if (fator === undefined) {
      fator = 1;
      problemas.push({ nivel: 'aviso', campo: nome, motivo: `unidade "${v.unidadeImpressa}" nao reconhecida; assumida ${ROTULO_UNIDADE[tipo]} pela faixa plausivel` });
    }
    const valor = Math.round(lido.valor * fator * 10000) / 10000;
    const [min, max] = FAIXAS[nome];
    if (valor < min || valor > max) {
      problemas.push({ nivel: USADOS_PELO_MOTOR.has(nome) ? 'bloqueio' : 'aviso', campo: nome,
        motivo: `${valor} fora da faixa plausivel ${min}-${max} ${ROTULO_UNIDADE[tipo]}; valor descartado` });
      continue;
    }
    campos[nome] = { ...base, valor, ...(fator !== 1 ? { origem: 'convertido', fator } : {}) };
  }

  // Conversoes com regra fixa, so quando o valor direto nao foi impresso
  if (!campos.potassioMgDm3 && campos.potassioCmolcDm3?.valor != null) {
    campos.potassioMgDm3 = { valor: Math.round(campos.potassioCmolcDm3.valor * 391 * 10) / 10, unidade: 'mg/dm3',
      pagina: campos.potassioCmolcDm3.pagina, origem: 'calculado', regra: 'K (mg/dm3) = K (cmolc/dm3) x 391' };
  }
  if (!campos.materiaOrganicaPercentual && campos.carbonoOrganicoPercentual?.valor != null) {
    campos.materiaOrganicaPercentual = { valor: Math.round(campos.carbonoOrganicoPercentual.valor * 1.724 * 100) / 100,
      unidade: '%', pagina: campos.carbonoOrganicoPercentual.pagina, origem: 'calculado', regra: 'MO = C organico x 1,724' };
    problemas.push({ nivel: 'aviso', campo: 'materiaOrganicaPercentual', motivo: 'MO estimada a partir do carbono organico (x 1,724)' });
  }

  const metodo = metodoPK(extraido.extratorPK);
  for (const c of ['fosforoMgDm3', 'potassioMgDm3']) if (campos[c]) campos[c].metodo = metodo;

  const laudo = {
    versaoContrato: 1,
    amostra: amostra.codigo,
    identificacao: amostra.identificacao ?? null,
    laboratorio: extraido.laboratorio ?? null,
    uf: ufDe(extraido.localizacao),
    camadaCm: camadaDe(amostra.profundidade) ?? camadaDe(amostra.identificacao),
    ...(extras.classeTextural ? { classeTexturalImpressa: Number(extras.classeTextural) } : {}),
    campos,
  };
  return { laudo, problemas };
}

export function extracaoParaLaudos(extraido) {
  return extraido.amostras.map(a => amostraParaLaudo(extraido, a));
}
