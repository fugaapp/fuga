# Arquitetura

## Três processos, uma direção

```
┌─────────────┐   IPC tipado (src/shared/ipc.ts)   ┌──────────────────────┐
│ main        │ ◀────────────────────────────────▶ │ renderer (React)     │
│ janela,     │        via preload (sandbox)       │ viewport + painéis   │
│ menus,      │                                    │        │             │
│ ficheiros   │                                    │        ▼             │
└─────────────┘                                    │  core (TS puro)      │
                                                   │  solver + exports    │
                                                   └──────────────────────┘
```

- **main** (`src/main`): só faz o que exige o sistema operativo — diálogos,
  ler e escrever ficheiros, menu. Não sabe nada de câmaras.
- **preload** (`src/preload`): expõe `window.fuga` com as funções do
  contrato em `src/shared/ipc.ts`. A interface corre com `sandbox: true` e
  `contextIsolation: true`, sem acesso a Node.
- **renderer** (`src/renderer`): React para os painéis, Canvas 2D para a
  viewport. Chama o core diretamente, porque o core é só matemática.
- **core** (`src/core`): solver, exportadores e formato de projeto. Não
  importa nada de fora.

## Fluxo de dados

```
Project (JSON, imutável)
   │  toSolverInput()
   ▼
SolverInput ──solveCamera()──▶ SolveResult { ok, solution | error }
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
               viewport        painel Camera     exportadores
```

O documento (`Project`) é a única fonte de verdade. Cada edição cria um novo
objeto. O `History` guarda os anteriores (undo/redo). O solver volta a correr
a cada alteração; demora microssegundos.

## Convenções de coordenadas

| Onde | Convenção |
| --- | --- |
| Pixels da imagem | origem no canto superior esquerdo, x → direita, y → baixo |
| Dentro do solver | centrado na imagem, lado maior ∈ [−1, 1] |
| Câmara (`CameraSolution`) | visão computacional: x direita, y baixo, z em frente. `x_cam = R · (X − C)` |
| Mundo | destro, **Z para cima** (igual ao Blender) |
| Blender | mundo Z-up; câmara olha para −Z local, +Y para cima |
| Maya, USD | mundo Y-up: `(x, y, z)` → `(x, z, −y)`; câmara olha para −Z |

A conversão para cada aplicação vive em `src/core/export/camera.ts`
(`cameraPlacement`, `lensShift`) e em mais lado nenhum.

## O solver em poucas linhas

1. **Ponto de fuga** (`vanishing.ts`): cada segmento vira uma reta
   homogénea `l`. O ponto de fuga `v` minimiza `Σ wᵢ (lᵢ · v)²` — o vetor
   próprio de menor valor próprio de `Σ wᵢ lᵢ lᵢᵀ`. Depois os pesos são
   ajustados para que o custo equivalha ao erro de clique (ver comentário no
   código).
2. **Focal** (2 VP): para direções perpendiculares,
   `(v₁ − p) · (v₂ − p) + f² = 0`, com `p` o ponto principal.
3. **Ponto principal** (3 VP): é o ortocentro do triângulo dos três pontos de
   fuga.
4. **Rotação**: a direção 3D de cada eixo é `(v − p, f)` normalizada; o
   terceiro eixo é o produto vetorial dos outros dois (sistema destro). A
   matriz é depois projetada na rotação mais próxima (decomposição polar).
5. **Posição**: a origem do mundo está no raio que passa pelo pixel da
   origem. A distância ao longo desse raio vem da distância de referência
   (mínimos quadrados) ou de um valor por omissão.

## Testes

`tests/synthetic.ts` constrói câmaras conhecidas e projeta arestas de uma
caixa. `tests/solver.test.ts` verifica que o solver as recupera;
`tests/export.test.ts` verifica que cada ficheiro exportado, interpretado com
o modelo de câmara da aplicação de destino, reproduz os mesmos pixels.
