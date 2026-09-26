// Conferencias cruzadas de um laudo do contrato: as contas que o proprio laboratorio faz.
// Numero lido na coluna errada quebra alguma conta; o campo culpado e o que nenhuma outra conta confirma.
import { USADOS_PELO_MOTOR } from './normalizar.mjs';

const r2 = x => Math.round(x * 100) / 100;

function valor(laudo, nome) {
  const c = laudo.campos[nome];
  if (!c) return null;
  if (c.valor === null && c.limite === 'abaixo') return 0; // "<LQ" entra nas contas como ~0
  return c.valor ?? null;
}

// Classe de argila do manual 2016 (Tabela 6.3): 1 >60, 2 41-60, 3 21-40, 4 <=20
const classeArgila = a => (a > 60 ? 1 : a > 40 ? 2 : a > 20 ? 3 : 4);

export function validarLaudo(laudo) {
  const v = nome => valor(laudo, nome);
  const ca = v('calcioCmolcDm3'), mg = v('magnesioCmolcDm3'), al = v('alTrocavelCmolcDm3');
  const kCmolc = v('potassioMgDm3') !== null ? v('potassioMgDm3') / 391 : v('potassioCmolcDm3');
  const sb = [ca, mg, kCmolc].every(x => x !== null) ? ca + mg + kCmolc : null;
  const K = 'potassioMgDm3', BASES = ['calcioCmolcDm3', 'magnesioCmolcDm3', K];

  const contas = [];
  const conta = (nome, campos, calculado, impresso, tolerancia) => {
    if (calculado === null || impresso === null) return;
    contas.push({ nome, campos, calculado: r2(calculado), impresso, tolerancia: r2(tolerancia),
      ok: Math.abs(calculado - impresso) <= tolerancia + 1e-9 });
  };
  const rel = (x, p, minimo) => Math.max(minimo, Math.abs(x ?? 0) * p);

  if (v(K) !== null) conta('K mg/dm3 / 391 = K cmolc', [K, 'potassioCmolcDm3'], v(K) / 391, v('potassioCmolcDm3'), rel(v('potassioCmolcDm3'), 0.05, 0.02));
  if (sb !== null) {
    conta('SB = Ca + Mg + K', [...BASES, 'somaBasesCmolcDm3'], sb, v('somaBasesCmolcDm3'), rel(sb, 0.03, 0.15));
    if (v('hAlCmolcDm3') !== null) conta('CTC pH7 = SB + H+Al', [...BASES, 'hAlCmolcDm3', 'ctcPh7CmolcDm3'], sb + v('hAlCmolcDm3'), v('ctcPh7CmolcDm3'), rel(sb + v('hAlCmolcDm3'), 0.025, 0.2));
    if (v('ctcPh7CmolcDm3')) conta('V% = SB / CTC pH7', [...BASES, 'ctcPh7CmolcDm3', 'saturacaoBasesPercentual'], 100 * sb / v('ctcPh7CmolcDm3'), v('saturacaoBasesPercentual'), 1.5);
    if (al !== null) {
      conta('CTC efetiva = SB + Al', [...BASES, 'alTrocavelCmolcDm3', 'ctcEfetivaCmolcDm3'], sb + al, v('ctcEfetivaCmolcDm3'), rel(sb + al, 0.03, 0.2));
      if (sb + al > 0) conta('m% = Al / (SB + Al)', [...BASES, 'alTrocavelCmolcDm3', 'saturacaoAlPercentual'], 100 * al / (sb + al), v('saturacaoAlPercentual'), 1.5);
    }
  }
  if (v('indiceSmp') !== null && v('hAlCmolcDm3') !== null) {
    const hal = Math.exp(10.665 - 1.1483 * v('indiceSmp')) / 10; // manual 2016, p. 54
    conta('H+Al = e^(10,665 - 1,1483 SMP)/10', ['indiceSmp', 'hAlCmolcDm3'], hal, v('hAlCmolcDm3'), rel(hal, 0.06, 0.3));
  }
  if (v('carbonoOrganicoPercentual') !== null && laudo.campos.materiaOrganicaPercentual?.origem !== 'calculado') {
    conta('MO = C x 1,724', ['carbonoOrganicoPercentual', 'materiaOrganicaPercentual'], v('carbonoOrganicoPercentual') * 1.724, v('materiaOrganicaPercentual'), rel(v('materiaOrganicaPercentual'), 0.06, 0.15));
  }
  if (laudo.classeTexturalImpressa && v('argilaPercentual') !== null) {
    conta('classe de argila (Tabela 6.3)', ['argilaPercentual', 'classeTexturalImpressa'], classeArgila(v('argilaPercentual')), laudo.classeTexturalImpressa, 0);
  }

  const confirmados = new Set(contas.filter(c => c.ok).flatMap(c => c.campos));
  const problemas = [];
  for (const c of contas.filter(x => !x.ok)) {
    const suspeitos = c.campos.filter(n => !confirmados.has(n) && (n in laudo.campos || n === 'classeTexturalImpressa'));
    const criticos = (suspeitos.length ? suspeitos : c.campos).filter(n => USADOS_PELO_MOTOR.has(n));
    problemas.push({
      nivel: criticos.length ? 'bloqueio' : 'aviso', conta: c.nome, suspeitos,
      motivo: `calculado ${c.calculado} x impresso ${c.impresso}` + (criticos.length ? '' : ' (valor nao usado nas recomendacoes)'),
    });
  }

  // Obrigatorios para interpretar P e K; os demais so limitam partes do relatorio
  for (const n of ['argilaPercentual', 'fosforoMgDm3', 'potassioMgDm3', 'ctcPh7CmolcDm3']) {
    if (v(n) === null) problemas.push({ nivel: 'bloqueio', campo: n, motivo: 'ausente no laudo; necessario para interpretar P e K' });
  }
  for (const n of ['phAgua', 'indiceSmp', 'materiaOrganicaPercentual']) {
    if (v(n) === null) problemas.push({ nivel: 'aviso', campo: n, motivo: 'ausente; parte do relatorio fica pendente' });
  }

  const status = problemas.some(p => p.nivel === 'bloqueio') ? 'bloqueado' : problemas.length ? 'aprovado_com_avisos' : 'aprovado';
  return { status, contas, problemas };
}
