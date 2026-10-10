# Decisões: das dores do fSpy ao desenho da Fuga

Pesquisa feita nas [issues do fSpy no GitHub](https://github.com/stuffmatic/fSpy/issues)
e em fóruns (Blender Artists, McNeel/Rhino). O fSpy é ótimo e gratuito, mas
está praticamente parado e as queixas repetem-se.

## O que os utilizadores pedem / reclamam

| Dor (fonte) | Resposta na Fuga |
| --- | --- |
| Só duas linhas por ponto de fuga: um clique impreciso estraga a câmara; pedidos de "mais linhas de correção" e de avaliar a qualidade do ponto de fuga (#152) | Qualquer número de linhas por grupo, combinadas por mínimos quadrados com reponderação pelo erro angular. Medidor de discordância (graus RMS) por ponto de fuga e avisos automáticos. |
| Sem undo/redo (#154) | Histórico completo desde o primeiro dia; um arrasto inteiro = um passo de undo. |
| Zoom fraco, lupa com zoom insuficiente e lenta, linha invisível dentro da lupa (#152, #154) | Zoom livre em torno do cursor até 6400 %, pixels nítidos quando ampliado, lupa ×2…×32 que desenha a foto **e** as linhas. |
| `Shift` fica preso no modo de precisão (#141) | O modo fino é lido em cada movimento do rato, nunca guardado. |
| Valor da distância de referência "salta" para 4 (#156) | Campos numéricos só aplicam o valor ao confirmar (Enter/sair do campo) e nunca reescrevem o que estás a escrever. |
| Sem slider de opacidade da sobreposição (#135) | Opacidade da sobreposição e escurecimento da foto ajustáveis. |
| AVIF (#134) | PNG, JPG, WEBP, AVIF, BMP, GIF (o que o Chromium descodifica). |
| O add-on do Blender parte a cada versão (4.0, …) e precisa de ser instalado; câmaras importadas ao contrário (#138, #143, fóruns) | Exporta um **script Python simples** que só usa API estável do Blender (lens, sensor, shift, matrix_world), escrito para o Blender 5.1. Nada a instalar. Matriz completa em vez de ângulos de Euler: sem ambiguidade de ordem de rotação. |
| Só existe importador para Blender; Rhino/Maya/outros ficam de fora (fóruns) | Blender, Maya, **USD** (abre em Houdini, C4D, Unreal, Omniverse, Blender, Maya) e JSON com tudo explícito. |
| "Unidades estranhas", tamanho do sensor não exposto (fóruns) | Focal em mm **e** em px, sensor escolhível; o JSON inclui a matriz K e as duas convenções de eixos escritas por extenso. |
| App não abre em macOS recentes / Ubuntu / Windows (#142, #144, #146–149, #153, #155, #159) | Electron atual, CI a compilar e testar a cada commit, instaladores gerados pelo `electron-builder`. |
| Instalar para todos os utilizadores (#150) | Instalador NSIS com escolha de pasta e de instalação por máquina. |
| Ficheiro de projeto binário | `.fuga` é JSON legível e versionado; aceita o caminho da foto relativo ao ficheiro do projeto. |

## Opiniões de arquitetura

**Electron em vez de Tauri.** Tauri gera binários muito menores, mas usa o
WebView do sistema: WebKitGTK no Linux, WebKit no macOS. Isso quer dizer que
o desenho no canvas e as fontes variam de sistema para sistema, e no Linux o
WebKitGTK tem um histórico de problemas de GPU. Numa ferramenta de precisão
visual quero o mesmo motor (Chromium) em todo o lado. O custo é o tamanho do
download (~100 MB). Como o núcleo (`src/core`) não depende de Electron,
mudar para Tauri mais tarde continua possível.

**O núcleo é TypeScript puro e isolado.** Sem DOM, sem Node. Corre igual na
app, nos testes e numa futura linha de comandos. É a parte que tem de estar
certa, por isso é a mais testada.

**Uma só convenção interna, convertida só à saída.** O solver trabalha na
convenção de visão computacional (x direita, y baixo, z para a frente; mundo
Z para cima). Cada exportador converte para a convenção da aplicação de
destino, e apenas aí. Metade dos bugs de "câmara ao contrário" nascem de
conversões espalhadas pelo código.

**Matrizes, não Euler, nos exports.** Os ângulos de Euler só aparecem no
painel, para leitura.

**Coordenadas normalizadas dentro do solver.** Os pixels são convertidos para
um referencial centrado com o lado maior em [−1, 1] antes das contas
(normalização de Hartley). Evita perder dígitos ao misturar valores na casa
dos milhares com valores perto de 1.

**Sem dependências na matemática.** Decomposição de matrizes 3×3 por Jacobi,
escrita à mão e testada. Uma biblioteca de álgebra linear seria maior do que
todo o solver.
