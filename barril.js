// Desenho do barril de Liebig (SVG). Usado no site (Diagnostico) e na funcao "barril" do Supabase,
// que transforma o mesmo SVG em PNG para o e-mail. Sem import/export: no navegador e script comum e
// no Deno e importado so pelo efeito (define globalThis.SoloiaBarril).
(function (g) {
  const COR = { muito_baixo: '#E24B4A', baixo: '#D85A30', medio: '#EF9F27', alto: '#639922', muito_alto: '#0F6E56' };
  const NOME = { muito_baixo: 'Muito baixo', baixo: 'Baixo', medio: 'Médio', alto: 'Alto', muito_alto: 'Muito alto' };
  const ALT = { muito_baixo: .2, baixo: .4, medio: .6, alto: .82, muito_alto: .95 };
  const NUT = { P: 'Fósforo', K: 'Potássio', Ca: 'Cálcio', Mg: 'Magnésio', S: 'Enxofre', Zn: 'Zinco', Cu: 'Cobre', B: 'Boro', Mn: 'Manganês', Fe: 'Ferro', Mo: 'Molibdênio' };
  const TEMAS = {
    escuro: { fundo: null, valor: '#b8cbe6', anel: '#0c1a33', sombra: .25 },
    claro: { fundo: '#ffffff', valor: '#333333', anel: '#ffffff', sombra: .15 },
  };
  const FONTE = "Inter, 'Segoe UI', system-ui, Arial, sans-serif";
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Tabuas mais curtas (todas as empatadas na menor altura)
  function limitantes(t) {
    const hs = t.map(x => ALT[x.cls]), mn = Math.min(...hs);
    return hs.map((h, i) => h === mn ? i : -1).filter(i => i >= 0);
  }

  // Frase neutra: "Limitante: Fosforo (muito baixo)." / empate / todas empatadas
  function frase(t, negrito = s => s) {
    const lis = limitantes(t);
    const nomes = lis.map(i => negrito(esc(t[i].nome || NUT[t[i].sim] || t[i].sim)));
    const lista = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
    const classe = NOME[t[lis[0]].cls].toLowerCase();
    if (lis.length === t.length) return `Limitantes: todas as tábuas empatadas em ${classe}.`;
    return `${lis.length > 1 ? 'Limitantes' : 'Limitante'}: ${lista} (${classe}). A água não passa dessa altura.`;
  }

  // t: [{ sim, valor, cls }] (cls: muito_baixo | baixo | medio | alto | muito_alto); devolve o <svg> completo
  function svg(t, { tema = 'escuro', id = 'veio' } = {}) {
    const T = TEMAS[tema] || TEMAS.escuro;
    const n = t.length, cx = 340, yB = 325, H = 250, R0 = 178, e = .22;
    const hs = t.map(x => ALT[x.cls]), mx = Math.max(...hs), mn = Math.min(...hs), lis = limitantes(t);
    const R = y => R0 * (.84 + .16 * Math.sin(Math.PI * Math.min(1, Math.max(0, (yB - y) / (H * mx)))));
    const P = (th, y) => [cx + R(y) * Math.sin(th), y + e * R(y) * Math.cos(th)];
    const TH = [...Array(n + 1)].map((_, i) => Math.asin(-1 + 2 * i / n));
    const yT = h => yB - h * H, yTop = yT(mx), lv = yT(mn);
    const xy = p => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    const pl = q => 'M' + q.map(xy).join('L') + 'Z';
    const arc = (t0, t1, y, k = 10) => [...Array(k + 1)].map((_, j) => P(t0 + (t1 - t0) * j / k, y));
    const edge = (th, y0, y1) => { const r = []; const st = y1 < y0 ? -5 : 5; for (let y = y0; st < 0 ? y > y1 : y < y1; y += st) r.push(P(th, y)); r.push(P(th, y1)); return r; };
    const volta = (y, sinal, de, ate) => [...Array(37)].map((_, k) => { const th = de + (ate - de) * k / 36; return [cx + R(y) * Math.sin(th), y + sinal * e * R(y) * Math.cos(th)]; });

    let s = `<defs><pattern id="${id}" width="16" height="64" patternUnits="userSpaceOnUse"><path d="M4 0Q1 16 4 32T4 64M11 0Q14 20 11 36T12 64" fill="none" stroke="#6B3E0E" stroke-width="1" opacity=".45"/></pattern></defs>`;
    if (T.fundo) s += `<rect x="110" y="0" width="460" height="425" fill="${T.fundo}"/>`;
    s += `<ellipse cx="${cx}" cy="${yB + e * R(yB) + 6}" rx="${R(yB) + 40}" ry="13" fill="#000" opacity="${T.sombra}"/>`;
    // parede de tras (interior) acima da agua; so aparece onde as tabuas da frente sao mais baixas
    if (lv - yTop > 1) {
      const back = [];
      for (let y = lv; y >= yTop; y -= 4) back.push([cx - R(y), y]);
      back.push(...volta(yTop, -1, -Math.PI / 2, Math.PI / 2));
      for (let y = yTop; y <= lv; y += 4) back.push([cx + R(y), y]);
      back.push(...volta(lv, 1, Math.PI / 2, -Math.PI / 2));
      s += `<path d="${pl(back)}" fill="#4A2C0C"/>`;
      TH.forEach(th => { s += `<line x1="${(cx + R(yTop) * Math.sin(th)).toFixed(1)}" y1="${(yTop - e * R(yTop) * Math.cos(th)).toFixed(1)}" x2="${(cx + R(lv) * Math.sin(th)).toFixed(1)}" y2="${(lv - e * R(lv) * Math.cos(th)).toFixed(1)}" stroke="#2E1B06" stroke-width="1.5"/>`; });
    }
    s += `<path d="M${volta(yTop, -1, -Math.PI / 2, Math.PI / 2).map(xy).join('L')}" fill="none" stroke="#9A6120" stroke-width="4" stroke-linecap="round"/>`;
    s += `<ellipse cx="${cx}" cy="${lv}" rx="${R(lv) - 1}" ry="${e * R(lv)}" fill="#85B7EB" stroke="#378ADD" stroke-width="1.5"/>`;
    s += `<ellipse cx="${cx - 25}" cy="${lv - 3}" rx="${R(lv) * .45}" ry="${e * R(lv) * .35}" fill="none" stroke="#E6F1FB" stroke-width="1.2" opacity=".8"/>`;
    const aros = [.1, .5, .86].map(f => yB - H * mx * f);
    t.forEach((x, i) => {
      const ta = TH[i], tb = TH[i + 1], yt = yT(hs[i]);
      const d = pl([...edge(ta, yB, yt), ...arc(ta, tb, yt), ...edge(tb, yt, yB), ...arc(tb, ta, yB)]);
      const xn = (Math.sin(ta) + Math.sin(tb)) / 2;
      let gr = `<g class="tabua" data-i="${i}"><path d="${d}" fill="${i % 2 ? '#C4832F' : '#B97828'}"/><path d="${d}" fill="url(#${id})"/>`;
      aros.forEach(hy => {
        if (yt >= hy - 10) return;
        const rb = P((ta + tb) / 2, hy + 5);
        gr += `<path d="${pl([...arc(ta, tb, hy, 6), ...arc(tb, ta, hy + 10, 6)])}" fill="#5F5E5A"/><path d="M${arc(ta, tb, hy + 1, 6).map(xy).join('L')}" fill="none" stroke="#B4B2A9" stroke-width="1"/><circle cx="${rb[0].toFixed(1)}" cy="${rb[1].toFixed(1)}" r="1.8" fill="#2C2C2A"/>`;
      });
      gr += `<path d="${d}" fill="#000" opacity="${(.4 * Math.abs(xn) ** 1.7).toFixed(3)}"/>`;
      if (xn > -.55 && xn < -.1) gr += `<path d="${d}" fill="#FFF" opacity=".07"/>`;
      s += gr + `<path d="${d}" fill="none" stroke="#4A2C0C" stroke-width="1.3"/></g>`;
    });
    // agua vazando por todas as tabuas mais curtas
    const topos = [];
    lis.forEach(li => {
      const tm = (TH[li] + TH[li + 1]) / 2, [x0, y0] = P(tm, lv), yG = yB + e * R(yB) * Math.cos(tm) + 6;
      // muitas tabuas vazando: filetes finos para nao cobrir o barril
      const wd = Math.min(26, Math.max(8, (P(TH[li + 1], lv)[0] - P(TH[li], lv)[0]) * (lis.length > 2 ? .3 : .62)));
      const L = [], Rr = [];
      for (let y = y0; y <= yG; y += 5) { L.push([x0 - wd / 2 + 2.5 * Math.sin(y / 7), y]); Rr.unshift([x0 + wd / 2 + 2.5 * Math.sin(y / 7 + 1.3), y]); }
      topos.push([x0, y0]);
      s += `<ellipse cx="${x0.toFixed(1)}" cy="${(yG + 3).toFixed(1)}" rx="${(wd * 1.9).toFixed(1)}" ry="7" fill="#378ADD" opacity=".45"/><path d="${pl([...L, ...Rr])}" fill="#378ADD" opacity=".75" style="pointer-events:none"/><ellipse cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" rx="${(wd / 2 + 4).toFixed(1)}" ry="4" fill="#85B7EB" style="pointer-events:none"/>`;
    });
    const py = Math.max(18, yTop - e * R(yTop) - 36), lx = topos.reduce((m, p) => m + p[0], 0) / topos.length;
    const lt = lis.length > 1 ? 'limitantes' : 'limitante', lw = lt.length * 7.5 + 26;
    if (lis.length <= 4) topos.forEach(([x, y]) => { s += `<path d="M${lx.toFixed(1)} ${(py + 12).toFixed(1)}L${x.toFixed(1)} ${(y - 6).toFixed(1)}" fill="none" stroke="#F09595" stroke-width="1.5" stroke-dasharray="3 3"/>`; });
    s += `<rect x="${(lx - lw / 2).toFixed(1)}" y="${(py - 12).toFixed(1)}" width="${lw}" height="24" rx="12" fill="#FCEBEB" stroke="#A32D2D"/><text x="${lx.toFixed(1)}" y="${(py + 4.5).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="#791F1F">${lt}</text>`;
    t.forEach((x, i) => {
      const [bx, by] = P((TH[i] + TH[i + 1]) / 2, yB), lim = lis.includes(i);
      s += `<circle cx="${bx.toFixed(1)}" cy="${(by + 28).toFixed(1)}" r="13" fill="${COR[x.cls]}" stroke="${lim ? '#F09595' : T.anel}" stroke-width="${lim ? 2.5 : 1.5}"/>`
        + `<text x="${bx.toFixed(1)}" y="${(by + 32).toFixed(1)}" text-anchor="middle" font-size="${x.sim.length > 1 ? 11 : 12}" font-weight="600" fill="${x.cls === 'medio' ? '#412402' : '#FFFFFF'}">${esc(x.sim)}</text>`
        + `<text class="bv" x="${bx.toFixed(1)}" y="${(by + 56).toFixed(1)}" text-anchor="middle" font-size="12" fill="${T.valor}">${esc(x.valor)}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 0 460 425" width="460" height="425" font-family="${FONTE}" role="img" aria-label="Barril de Liebig com uma tábua por nutriente">${s}</svg>`;
  }

  g.SoloiaBarril = { svg, frase, limitantes, COR, NOME, ALT, NUT };
})(typeof globalThis !== 'undefined' ? globalThis : window);
