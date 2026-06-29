# Trabalho de CG - Editor de Cena em WebGL2

Esse repositório representa a minha segunda tentativa de fazer o trabalho de CG, dessa vez usando o twgl.js e não usando modelos que façam o GitHub reclamar.

## Como rodar

Só ir pra pasta principal do projeto e rodar:

```
python3 -m http.server 8000
```

depois abrir `http://localhost:8000` no navegador.

## Estrutura dos arquivos

```
index.html        estrutura das 3 colunas: menu de propriedades | cena | lista de modelos
style.css         estilos
main.js           ponto de entrada: inicializa renderer, UI e o loop de render
shaders.js        os shaders GLSL
model-loader.js   catálogo de modelos, fetch/parse de .obj/.mtl, cache de geometria/textura
renderer.js       setup do WebGL, thumbnails, câmera orbital, picking, loop de renderização
ui.js             sliders, hierarquia, painel de propriedades, salvar/carregar json
obj-loader.js     parseOBJ / parseMTL (baseado no webgl2fundamentals.org)
scene-graph.js    Node do scene graph (hierarquia local/world matrix)
models/           os .obj e .mtl do pacote Fast Food (40 modelos)
textures/         as 3 texturas (atlas) usadas pelos modelos
```

`twgl.js` e `m4.js` não estão na pasta pois são carregados direto do CDN oficial do webgl2fundamentals, 
ou seja, é preciso acesso à internet pra essas duas linhas carregarem.

## Se quiser usar outro pacote de modelos

Só colocar os novos `.obj`/`.mtl` em `models/` (e as texturas que eles
referenciam em `textures/`, ajustando o caminho relativo no `map_Kd` do
`.mtl` se precisar) e atualizar a lista `MODEL_NAMES` no topo do
`model-loader.js` com os nomes dos arquivos (sem a extensão `.obj`).
