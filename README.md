# Solo+IA — app (bloco HTML do site)

Tela de envio da análise de solo, carregada pelo bloco HTML da página de upload do site
Wix (www.solomaisia.com.br) via GitHub Pages.

- `index.html` — formulário de upload + chat do laudo. Conversa com o page code do Wix por
  `postMessage` (`soloia:getAuth` / `soloia:auth`) e envia o PDF ao webhook `soloia-upload` do n8n
  com a identidade assinada pelo backend do Wix (`memberId`, `memberEmail`, `exp`, `sig`).

Qualquer push na `main` publica automaticamente.
