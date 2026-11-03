# Plano: primitivos de formulário próprios

Status: **implementado** (Select, Slider, ColorPicker, Disclosure e FilePicker; `file-button` e `asset-picker` seguem como botões com input oculto).

## Decisão

Substituir os controles nativos que variam entre navegadores e sistemas por primitivos próprios, com a mesma aparência em qualquer plataforma. Isso **reverte** a decisão de `docs/FRONTEND.md` ("Select: native, decided"), que deve ser atualizada no mesmo commit que introduzir o primitivo.

Escolhas já tomadas:

- **Select customizado em todas as larguras, inclusive no celular.** O objetivo é aparência e comportamento idênticos; o seletor nativo do iOS/Android deixa de ser usado. Em troca, o primitivo precisa de teste de teclado, leitor de tela e toque (ver Verificação).
- **Sem dependência nova.** O projeto já tem o pacote `radix-ui` (^1.8.1, MIT, compatível com AGPL-3.0), que inclui `Select`, `Slider` e `Collapsible`.
- **Orçamento do bundle:** o entry de login está em 214,5 KB de 215 KB gzip e usa o seletor de idioma, então o `Select` entra no entry. O orçamento sobe **só o necessário**, no mesmo commit, com a medição registrada no `scripts/check-bundle-size.mjs`. Se o aumento passar de ~8 KB gzip, reavaliar (seletor de idioma simples no login, `Select` completo lazy no resto).

## Escopo

| Primitivo | Substitui | Usos hoje | Base |
|---|---|---|---|
| `Select` | `<select>` nativo (`ui/input.tsx:24`) | ~25 (idioma, papel, convite, tema, régua, desenho, grade, sistema, destinatário do chat, ficha, token) | Radix Select |
| `Slider` | `<input type="range">` | 4 (`GridAdjuster`, `TokenEditor`, `SoundSetting`) | Radix Slider |
| `ColorPicker` | `<input type="color">` | 3 (`JoinInviteScreen`, `DrawOptions`, `TokenEditor`) | paleta do `DESIGN.md` + campo hex opcional |
| `Disclosure` | `<details>` | 2 (`MapImportDialog`, `JournalPanel`) | Radix Collapsible |
| `FilePicker` | `file-button` + `asset-picker` + 4 `<input type="file">` soltos | 5 | unificar em uma primitiva |

Fora do escopo: `Checkbox` e `Switch` (já são nativos estilizados em `ui/checkbox.tsx`, aparência consistente), `<input type="date">` (não há uso).

## Ordem

1. `Select`, mantendo a API dos call-sites o mais próxima possível (`value`, `onValueChange`, filhos `<option>` convertidos para `options` ou `Select.Item`). Migrar um arquivo por vez, commit por área.
2. `Slider`.
3. `ColorPicker`.
4. `Disclosure`.
5. `FilePicker`.
6. Atualizar `FRONTEND.md` (inventário 2.1) e `DESIGN.md` (componentes), e o eixo 9 da auditoria.

Cada primitivo entra com story, teste de comportamento e axe, claro e escuro, como a regra 4 do `FRONTEND.md`.

## Pontos de atenção

- **Formulários nativos:** `<select name="gridType" defaultValue=...>` em `SceneForms` e `WorldListScreen` é lido via `FormData`. O Radix Select renderiza um `<select>` oculto quando recebe `name`; conferir que o valor continua indo no submit.
- **Dentro de diálogos e popovers:** o conteúdo do Select abre em portal; definir a camada na escala de z-index (item D-03 da auditoria) e testar foco e Esc dentro de `Dialog`.
- **Toque:** itens com ao menos 44px de altura; rolagem da lista longa (idiomas, sistemas) sem prender a rolagem da página.
- **Teclado:** setas, Home/End, digitação para buscar, Esc; `aria-label` obrigatório quando não há `Field`.
- **forced-colors:** o item selecionado e o gatilho não podem depender só de `background` (ver A-01).
- **Mapa:** os selects de régua e desenho ficam sobre o canvas; garantir que abrir e fechar não perca o foco da ferramenta.

## Verificação

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:i18n`, `pnpm check:bundle`, e2e com axe nas telas que usam o Select, mais teste manual com teclado, toque emulado e (se disponível) leitor de tela. Snapshots visuais só atualizados com a mudança intencional explicada.
