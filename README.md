# Fuga

Calibração de câmara a partir de uma única fotografia, por pontos de fuga.
Traças as arestas paralelas da foto, a Fuga calcula a distância focal, a
rotação e a posição da câmara, e exporta uma câmara pronta para **Blender**,
**Maya**, **USD** (Houdini, Cinema 4D, Unreal, Omniverse…) ou **JSON**.

Inspirada no [fSpy](https://github.com/stuffmatic/fSpy), reescrita do zero
para resolver as queixas mais comuns dos utilizadores dele: ver
[docs/DECISOES.md](docs/DECISOES.md).

> O nome vem de *ponto de fuga*.

## Correr

Precisas de Node 22.12 ou mais recente.

```bash
npm install        # instala dependências (e descarrega o Electron)
npm run dev        # abre a app com hot-reload
npm test           # testes de precisão do solver e dos exportadores
npm run typecheck  # verifica os tipos de todo o projeto
npm run dist       # gera o instalador para o teu sistema (pasta release/)
```

Para experimentar sem foto tua: `npm run sample` gera
`samples/synthetic-box.png` (uma caixa renderizada com uma câmara
**conhecida**) e `samples/synthetic-box.fuga` (o projeto com as arestas já
traçadas). Abre o `.fuga` em *File → Open Project* e compara o painel
*Camera* com `samples/synthetic-box.truth.json`: focal 1650 px, posição
(7, −9, 1.7).

## Como se usa

1. **Abrir foto** — arrasta para a janela ou `Ctrl/⌘ O`.
2. **Escolher o método** — 2 VP serve para a maioria das fotos de
   arquitetura/interiores. 3 VP quando as verticais também convergem (foto
   tirada de cima ou de baixo). 1 VP quando só uma direção converge e sabes
   a distância focal.
3. **Traçar as linhas** — arrasta as pontas para cima de arestas paralelas
   reais. O eixo escolhido em cada grupo é o que **se afasta da câmara**,
   em direção ao ponto de fuga. Usa `+ line` para acrescentar mais linhas:
   cada linha extra reduz o erro.
4. **Origem e escala** — arrasta o ◯ para o ponto que deve ser (0, 0, 0).
   Liga *Reference distance* e arrasta o ◇ até um ponto de distância
   conhecida ao longo de um eixo (ex.: uma porta com 2,1 m).
5. **Verificar** — a grelha do chão e o horizonte têm de "assentar" na foto.
   O medidor de cada ponto de fuga mostra quanto as linhas discordam entre si
   (em graus): perto de 0 = bom.
6. **Exportar** — um clique. No Blender: *Text Editor → Open → Run Script*.
   No Maya: *Script Editor → Python → Execute*.

| Atalho | Ação |
| --- | --- |
| roda do rato / pinça | zoom em torno do cursor |
| arrastar no vazio | mover a vista |
| `Shift` + arrastar | movimento fino (10×) |
| setas / `Shift` + setas | empurrar o ponto selecionado 1 px / 0,1 px de ecrã |
| `[` `]` | zoom da lupa (×2 … ×32) |
| `Delete` | apagar a linha selecionada |
| `F`, `Ctrl/⌘ 0`, `Ctrl/⌘ 1` | enquadrar foto, enquadrar, pixels reais |
| `Ctrl/⌘ Z`, `Ctrl/⌘ Shift Z` | desfazer / refazer |

## Estrutura

```
src/
  core/        Matemática pura em TypeScript — sem DOM, sem Node, sem Electron.
    math/        vetores, matrizes 3×3, decomposição em valores próprios
    solver/      pontos de fuga, solver 1/2/3 VP, projeção
    export/      Blender, Maya, USD, JSON
    project/     formato do ficheiro .fuga
  main/        Processo principal do Electron: janela, menus, ficheiros
  preload/     Ponte segura entre o Electron e a interface
  shared/      Contrato de IPC (tipos partilhados main ↔ interface)
  renderer/    Interface em React
    src/viewport/  canvas: desenho, arrastar, zoom, lupa
    src/panels/    painel lateral
    src/state/     documento + histórico de undo
tests/         Testes do core com câmaras sintéticas (ground truth)
scripts/       Gerador da imagem de exemplo
docs/          Decisões, arquitetura e roadmap
```

Mais detalhe em [docs/ARQUITETURA.md](docs/ARQUITETURA.md). O que vem a seguir
está em [docs/ROADMAP.md](docs/ROADMAP.md).

## Precisão, e como é verificada

- Cada teste cria uma câmara **conhecida**, projeta as arestas de uma caixa,
  entrega os pixels ao solver e compara: focal, rotação e posição voltam com
  erro da ordem de 10⁻⁹.
- Os exportadores são testados em *round-trip*: lê-se o ficheiro gerado,
  reconstrói-se o modelo de câmara do Blender/Maya/USD e confirma-se que
  cada ponto 3D cai no mesmo pixel.
- O `.usda` exportado foi também aberto com a biblioteca oficial da Pixar
  (`usd-core`): os cantos da caixa caem nos pixels certos a menos de
  0,000001 px.
- Teste de ruído: com cliques imprecisos (σ = 0,7 px), 10 linhas por ponto
  de fuga dão um erro de focal claramente menor do que 2 linhas.
