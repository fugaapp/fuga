# Roadmap

Ordenado pelo que mais melhora a precisão e a confiança no resultado.

## Próximo

- [ ] **Incerteza visível.** Simular ruído de clique (Monte Carlo sobre as
      linhas atuais) e mostrar a focal como `31.2 ± 0.4 mm`. Diz ao
      utilizador *quando* deve acrescentar linhas.
- [ ] **EXIF.** Ler a focal equivalente a 35 mm da foto e usá-la como
      verificação ("o solver diz 28 mm, o EXIF diz 26 mm") e como valor
      inicial no modo 1 VP. Base de dados de sensores por modelo de câmara.
- [ ] **Encaixe nas arestas.** Ao largar uma ponta, ajustá-la à aresta mais
      forte da imagem por perto (gradiente sub-pixel). Pedido do fSpy #157.
- [ ] **Deteção automática de linhas** (LSD) para sugerir grupos de linhas.
- [ ] **Avisar ao fechar** com alterações por guardar; *relink* da foto
      quando o caminho mudou.

## Depois

- [ ] **Distorção de lente.** Modelo Brown–Conrady (k1, k2) estimado a partir
      de linhas que deviam ser retas ("plumb-line"). O fSpy não suporta lentes
      com distorção forte.
- [ ] Exportadores nativos: Nuke (`.nk`), After Effects (`.jsx`),
      Cinema 4D, Houdini (`.hip` via Python), FBX.
- [ ] Guias extra: cilindro com eixo escolhível, mais do que um guia, guias
      escaláveis (fSpy #154).
- [ ] Várias fotos com a mesma câmara / mesmo espaço.
- [ ] Panorâmicas 360° (fSpy #139).
- [ ] Interface em português (as strings estão concentradas nos painéis).

## Por validar em aplicações reais

Os exports estão testados contra os modelos de câmara documentados e o USD
contra a biblioteca da Pixar, mas falta abrir em cada aplicação:

- [ ] Blender 5.1: correr o script exportado com `samples/synthetic-box.fuga`.
- [ ] Maya: confirmar que o `imagePlane` acompanha o *film offset* quando o
      ponto principal não está no centro (modo 3 VP ou manual).
- [ ] Houdini / C4D / Unreal: importar o `.usda`.
