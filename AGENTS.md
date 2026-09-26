# Shortlink Skipper — instruções do projeto

Userscript em **arquivo único** (`shortlink-skipper.user.js`, ~2500 linhas).
Nunca reintroduzir estrutura multi-arquivo, build ou `dist/` — houve uma
migração para a arquitetura do adsbypasser e ela foi revertida de propósito.

## Arquitetura

- Engine de regras em `GENERIC_RULES`: a primeira regra cujo `run()` retorna
  truthy vence e encerra o loop. Regras específicas de host vêm antes das
  genéricas (`network-capture` em diante).
- O loop só roda se a página parecer shortener (`looksLikeShortlink()`),
  for host conhecido (`knownShortener()` / `knownMediaHost()`) ou bypass.tools.
- Toda navegação passa por `goto()` — validação centralizada, anti-loop
  (10 hops) e recusa sob stand-by do Cloudflare. Nunca usar `location.href`
  direto em regra nova.
- Captchas nunca são resolvidos nem adulterados — só observados
  (`captcha-manual` age depois que o usuário resolve).

## Receita para novo site

1. `const FOO_HOST = /(^|\.)foo\.com$/` junto às demais consts de host.
2. `async function handleFoo()` — **primeira linha** retorna `false` em outro
   host. Usa `waitFor(seletor, timeout)` limitado em vez de `sleep` cego.
   Clica com `fireClick`, segue link com `goto`.
3. Entrada em `GENERIC_RULES` antes das regras genéricas:
   `{ name: 'foo', when: () => FOO_HOST.test(location.host), run: handleFoo }`.
4. Exportar em `module.exports` (os testes carregam o script via `vm`).
5. Gate: adicionar o host a `EXTRA_SHORTENER_HOSTS` (shorteners),
   `IMAGE_HOSTS` ou `FILE_HOSTS` (mídia) — **exceto** homes de uso geral
   (lição `spaste.com`: pastebin home gerou falsos positivos; só o path
   `/site/` tem regra).
6. Teste em `tests/` (ver `tests/ports.test.js` como modelo): caminho feliz
   com mocks + `false` em outro host. `waitFor` resolve de imediato com mock
   presente, então testes ficam rápidos.
7. Docs: linha na tabela de regras do `README.md` + entrada no `CHANGELOG.md`.

## Restrições duras

- Código do userscript após a linha 14 deve ser **ASCII puro** (o CI verifica).
- Sem dependências externas, sem `fetch` para APIs novas sem circuit breaker.
- Não tocar em `google/youtube/captcha/cloudflare` (`EXCLUDE_HOSTS`).
- Não portar hosts adultos (decisão do mantenedor — P3 descartada).
- Técnicas vindas do adsbypasser são BSD-3-Clause: manter menção de origem
  no comentário da regra e na tabela do README.

## Comandos

```bash
node --check shortlink-skipper.user.js   # sintaxe
npm test                                 # suite node:test + harness vm
```

## Fluxo

Branch a partir de `main` → PR → merge squash. `main` é protegida e exige
o check `syntax` do workflow `Validate`. Bump de versão = `@version` no
header + `package.json` + CHANGELOG. Instalação é via raw do `main`
(`@downloadURL`/`@updateURL`), sem releases.
