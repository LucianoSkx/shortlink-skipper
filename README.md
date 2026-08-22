# Shortlink Skipper

Userscript próprio para pular encurtadores de links automaticamente. Inspirado no conceito do [Bypass All Shortlinks](https://greasyfork.org/pt-BR/scripts/431691) e da variante [Manual Captcha](https://openuserjs.org/scripts/Bloggerpemula/Bypass_All_Shortlinks_Manual_Captcha), mas escrito do zero com arquitetura enxuta e extensível.

## Instalação

1. Instale [Violentmonkey](https://violentmonkey.github.io/) ou Tampermonkey.
2. Instale o script por este link (a extensão abre a tela de instalação sozinha):

   <https://github.com/LucianoSkx/shortlink-skipper/raw/main/shortlink-skipper.user.js>

   Ou crie um novo script manualmente e cole o conteúdo de `shortlink-skipper.user.js`.

## Como funciona

Em vez de manter milhares de regras por site, usa ferramentas genéricas que cobrem a maioria dos encurtadores (que usam os mesmos templates):

| Regra | O que faz |
| --- | --- |
| `ouo` | ouo.io/press/today: submete `#form-captcha`/`#form-go` em loop até a etapa avançar; ouo.today usa o global `nextUrl` |
| `adfoc` | adfoc.us: redireciona via global `click_url` |
| `aylink-family` | aylink.co e afins: troca `_a/_t/_d` por token em `/get/tk` e conclui em `/links/go2` |
| `bcvc` | bcvc.live/xyz: POST `/ln.php` com os globals ofuscados da página |
| `skip-button-dest` | hurirk/usfinf/xervoo: extrai destino do `#skip_bu2tton` (param `dest=`) e resolve `/ad/locked` |
| `acortalink` | acortalink.me: converte popups em redirects, engana o contador via postMessage e clica o botão final |
| `bstlar` | bstlar.com: intercepta o XHR de "tasks" e marca a tarefa como concluída na API para receber o destino |
| `linkvertise-easy` | linkvertise.com com `?r=` base64: decodifica e vai direto ao destino |
| `servico-externo` | Sites sem bypass local conhecido (Linkvertise hard case, loot-links, admaven): delega ao serviço público [adbypass.org](https://adbypass.org) |
| `destino-na-url` | Extrai `?url=`, `?u=`, `?go=` etc. da barra de endereço (com decodificação base64/hex) e vai direto ao destino |
| `adlinkfly` | Template AdLinkFly (usado por ~20 encurtadores: exey.io, fc-lc.com, shrinkme, stfly.me, pnd.*, urlcik...): serializa os campos hidden e faz POST em `/links/go`, com retentativas |
| `adlinkfly-captcha` | Clica o captcha invisível (`#invisibleCaptchaShortlink`) assim que ele habilita |
| `go-link-form` | Encontra `form#go-link`, espera o botão liberar e submete/clica sozinho |
| `wpsafelink` | Template WordPress WPSafeLink: clica o botão da landing, espera o timer zerar, chama `wpsafegenerate()` e extrai o link final |
| `captcha-manual` | Se há hCaptcha/reCAPTCHA/Turnstile, aguarda você resolver manualmente (até 3 min) e então auto-submete o formulário/botão — nunca toca no captcha em si |
| `captcha-matematica` | Resolve captchas do tipo "12 + 7 = ?" e preenche o campo |
| `botao-final` | Clica automaticamente em "Get Link", "Continue", "Skip" etc. |
| `unico-link-externo` | Se a página só tem um link externo plausível, redireciona |

## Créditos

As famílias `ouo`, `adfoc`, `aylink-family`, `bcvc`, `skip-button-dest`, `adlinkfly` e `adlinkfly-captcha` são portas dos handlers do [adLBypasser v1.6](https://greasyfork.org/pt-BR/scripts/439469) de [fir4tozden](https://greasyfork.org/pt-BR/users/932504-fir4tozden), licenciado sob **MIT** — reescritas no formato de regras deste projeto.

As famílias `acortalink`, `bstlar`, `linkvertise-easy`, `servico-externo` e o filtro de infraestrutura do detector de links são inspirados nas técnicas do fork [bypass-all-shortlinks-debloated](https://codeberg.org/Amm0ni4/bypass-all-shortlinks-debloated) de Amm0ni4 (que por sua vez credita AdGuard Team e FastForward), reimplementadas do zero aqui.

Além das regras, aplica proteções globais:

- **Timers acelerados** — countdowns andam até 15x mais rápido em páginas que parecem shortlink
- **Popups bloqueados** — `window.open` vira no-op
- **Foco restaurado** — página nunca "perde foco" (anula detecção de aba inativa)
- **Banner anti-adblock removido**
- **Interações liberadas** — botão direito, copiar e selecionar texto voltam a funcionar
- **Anti-loop** — guarda histórico de navegação na sessão; se detectar redirecionamento circular, aborta

## Segurança embutida

- Roda apenas no frame principal (`window.top`)
- Lista de exclusão: Google, YouTube, hCaptcha/reCAPTCHA, Cloudflare nunca são tocados
- Aceleração de timers e auto-click só ativam quando a página parece shortlink (`form#go-link` ou frases como "please wait")
- Menu do userscript permite **desativar por domínio** com um clique

## Adicionar uma regra específica

Para um site com comportamento próprio, adicione um objeto em `GENERIC_RULES`:

```js
{
  name: 'meu-site',
  when: () => /meusite\.example/.test(location.host),
  run: async () => {
    const dest = await waitFor(() =>
      document.querySelector('#token')?.value);
    return goto(`https://destino.final/?t=${encodeURIComponent(dest)}`);
  },
}
```

A primeira regra que agir encerra o fluxo — coloque as mais específicas primeiro.

## Desenvolvimento

Validar sintaxe após edições:

```
node --check shortlink-skipper.user.js
```
