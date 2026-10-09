/* ==========================================================================
   S.I.G.E. - ElevaLife · V 1.37
   Foto(s) da atividade da AET nos e-mails das acoes de origem AET (pedido do
   Alexandre, 09/10/2026: "Acao da AET quando enviar e-mail para o
   responsavel, mandar a foto da atividade"). A acao aponta para a linha do
   Inventario ("Fator Risco Id"), que guarda "AET Id" e "AET Fator"; a foto
   vem da atividade da AET que tem esse fator. As fotos vao como anexos
   INLINE (aparecem no corpo do e-mail) - ver enviarEmail({ anexos }).
   ========================================================================== */
"use strict";

const { obterContainer } = require("./cosmos");
const { obterContainerCliente } = require("./blob");

async function porId(colecao, id) {
  const { resources } = await obterContainer(colecao).items.query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] }).fetchAll();
  return resources[0] || null;
}

// V 1.37: acao da AET - o e-mail ao responsavel leva a(s) foto(s) da atividade (anexos inline).
// Limite do Microsoft Graph (/sendMail): ~4 MB por requisicao -> ate 4 fotos, cada uma ate 2 MB e
// no total ate 2,7 MB (o base64 cresce ~33%); a que nao couber fica indicada no texto.
const MAX_FOTO_EMAIL = 2 * 1024 * 1024, MAX_TOTAL_EMAIL = 2.7 * 1024 * 1024;
function bufferDoStream(stream) {
  return new Promise((resolve, reject) => { const p = []; stream.on("data", (d) => p.push(d)); stream.on("end", () => resolve(Buffer.concat(p))); stream.on("error", reject); });
}
async function fotosDaAcaoAET(acao, context) {
  try {
    if (acao.Origem !== "AET" || !acao["Fator Risco Id"]) return null;
    const fr = await porId("fatorRisco", acao["Fator Risco Id"]);
    const aetId = (fr && fr["AET Id"]) || null; const uidF = fr && fr["AET Fator"];
    if (!aetId) return null;
    const aet = await porId("aet", aetId);
    if (!aet || !Array.isArray(aet.Atividades)) return null;
    const at = aet.Atividades.find((a) => (a.fatores || []).some((f) => f.uid === uidF)) || aet.Atividades.find((a) => a.nome && a.nome === acao.Atividade);
    const fotos = ((at && at.fotos) || []).filter((f) => f && typeof f.chave === "string" && f.chave.split("/")[0] === (acao.EmpresaId || aet.EmpresaId) && f.chave.split("/")[1] === "aet").slice(0, 4);
    if (!fotos.length) return null;
    const anexos = [], lista = []; let total = 0, fora = 0;
    for (let i = 0; i < fotos.length; i++) {
      try {
        const dl = await obterContainerCliente("aet").getBlockBlobClient(fotos[i].chave).download();
        const buf = await bufferDoStream(dl.readableStreamBody);
        if (!buf.length || buf.length > MAX_FOTO_EMAIL || total + buf.length > MAX_TOTAL_EMAIL) { fora++; continue; }
        const tipo = /png$/i.test(fotos[i].chave) || dl.contentType === "image/png" ? "image/png" : "image/jpeg";
        const cid = `foto${i + 1}.atividade@sige`;
        anexos.push({ nome: fotos[i].nomeArquivo || `foto-atividade-${i + 1}.${tipo === "image/png" ? "png" : "jpg"}`, tipo, conteudo: buf, cid });
        lista.push({ cid, legenda: fotos[i].legenda || "" }); total += buf.length;
      } catch (e) { fora++; if (context && context.error) context.error("Foto da AET indisponivel para o e-mail: " + fotos[i].chave, e); }
    }
    return { anexos, fotos: lista, semFoto: fora ? `${fora} foto(s) da atividade não couberam no e-mail; veja na AET, no S.I.G.E.` : "" };
  } catch (e) {
    if (context && context.error) context.error("Falha ao buscar as fotos da atividade da AET", e);
    return null;
  }
}


module.exports = { fotosDaAcaoAET };
