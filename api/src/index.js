/* ==========================================================================
   BI Ergonomia - ElevaLife
   Ponto de entrada unico da API (aponte "main" do package.json pra ca, em vez
   de um glob "src/functions/*.js") - forca o carregamento explicito de TODAS
   as functions, garantindo que app.http() rode pra cada uma delas.

   Motivo: em producao (Azure Static Web Apps - Managed Functions), o glob no
   "main" so registrou "entidades" (rota generica "{colecao}/{id?}"); "me" e
   "usuarios" nunca foram carregadas, entao toda chamada pra /api/me e
   /api/usuarios caia na rota generica e devolvia "Colecao desconhecida".
   Exigir cada arquivo aqui elimina essa ambiguidade de descoberta.
   ========================================================================== */

"use strict";

require("./functions/me");
require("./functions/usuarios");
require("./functions/entidades");
