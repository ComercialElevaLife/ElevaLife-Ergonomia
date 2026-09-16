/* ==========================================================================
   BI Ergonomia - ElevaLife
   Ponto de entrada unico da API (aponte "main" do package.json pra ca).

   So existe UM app.http() registrado (em entidades.js, route "{colecao}/{id?}"),
   que despacha internamente pra "me" e "usuarios" tambem (ver comentario em
   src/functions/me.js) - em producao (Azure Static Web Apps - Managed
   Functions, plano Free), registrar "me"/"usuarios" como functions HTTP
   separadas nunca teve suas rotas reconhecidas pelo proxy do SWA, entao
   um unico entry point evita esse problema por completo.
   ========================================================================== */

"use strict";

require("./functions/entidades");
