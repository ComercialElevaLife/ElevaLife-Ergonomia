/* ==========================================================================
   S.I.G.E - ElevaLife · V 1.34
   Gerador de PDF por blocos (mesmo motor do laudo psicossocial, padrao de laudo
   ElevaLife: capa, sumario, titulos, paragrafos, tabelas, imagens, fotos,
   fechamento com assinaturas e QR Code). Usado pelo laudo da AET. O Word sai
   dos mesmos blocos por BI.LaudoDocx.deBlocos.
   Blocos: {t:"h",l,x,toc,pb} {t:"p",runs:[{x,b,c,s}],al,s,sa,sb,ind,mark,keep,pb}
           {t:"tb",w:[...],rows:[[{p:[{runs,s,al,c}],f,span,c}]],hdr,keep,va,zebra}
           {t:"img",d,w,h} {t:"fotos",itens:[{d,leg}],alt} {t:"toc"} {t:"pb"} {t:"esp",h} {t:"fech",...}
   ========================================================================== */
(function (window) {
  "use strict";
  const BI = (window.BI = window.BI || {});
  const COR={wine:"8B3A42",deep:"5E2A30",mid:"A34E56",soft:"C99AA0",tint:"EBD9DB",ink:"3A2A2E",mut:"8A7A78",ln:"EADDE0",ok:"2E7D5B",teal:"3E7B7E",warn:"C9822B",bad:"B23A48",crit:"7E1F2C",g0:"8CCBEB",g1:"2E8B57",g2:"F2C230",g3:"C62828",g4:"6A3D9A"};
  const PDFL={W:595.28,H:841.89,ML:42,MR:42,TOP:70,BOT:52,get CW(){return this.W-this.ML-this.MR}};
  const hexRGB=h=>{ h=String(h||"3A2A2E").replace("#",""); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };
  function renderPDF(blocos,opc){
    const jsPDFC=window.jspdf&&window.jspdf.jsPDF; if(!jsPDFC) throw new Error("O gerador de PDF não carregou. Recarregue a página.");
    let mapa={paginas:[],total:0};
    const desenhar=(final)=>{
      const doc=new jsPDFC({unit:"pt",format:"a4",compress:true});
      let temFontes=false; try{ if(window.BI&&BI.registrarFontesPDF){ BI.registrarFontesPDF(doc); temFontes=true; } }catch{}
      const FN=temFontes?"Montserrat":"helvetica", FT=temFontes?"MontserratAlternates":"helvetica";
      const fonte=(b,tam,tit)=>{ doc.setFont(tit?FT:FN,(tit||b)?"bold":"normal"); doc.setFontSize(tam); };
      const corT=h=>{ const c=hexRGB(h); doc.setTextColor(c[0],c[1],c[2]); }, corF=h=>{ const c=hexRGB(h); doc.setFillColor(c[0],c[1],c[2]); }, corL=(h,w)=>{ const c=hexRGB(h); doc.setDrawColor(c[0],c[1],c[2]); doc.setLineWidth(w||.5); };
      const {W,H,ML,MR,TOP,BOT}=PDFL, CW=W-ML-MR, LIM=H-BOT;
      let pag=1, y=TOP, hIdx=0; const tocPos=[];
      const novaPag=()=>{ doc.addPage(); pag++; y=TOP; };
      const garantir=h=>{ if(y+h>LIM){ novaPag(); return true; } return false; };
      const varsTot=t=>String(t).replace(/\{totalPaginas\}/g,final?String(mapa.total):"000");
      // ---- quebra de linhas de runs ----
      function palavras(runs){ const ws=[]; runs.forEach(r=>{ const tx=varsTot(r.x); const partes=tx.split(/(\s+)/); partes.forEach(p=>{ if(p==="") return; if(/^\s+$/.test(p)){ if(ws.length) ws[ws.length-1].esp=true; return; } ws.push({t:p,b:!!r.b,c:r.c,s:r.s,esp:false}); }); }); return ws; }
      function linhas(runs,larg,tamBase){ const ws=palavras(runs), out=[]; let lin=[],w=0;
        ws.forEach(p=>{ fonte(p.b,p.s||tamBase); p.w=doc.getTextWidth(p.t); fonte(p.b,p.s||tamBase); p.e=doc.getTextWidth(" ");
          const prev=lin[lin.length-1]; const nw=lin.length?w+(prev.esp?prev.e:0)+p.w:p.w;
          if(p.w>larg){ // palavra maior que a coluna (ex.: códigos): quebra por caractere
            let resto=p.t; if(lin.length){ out.push(lin); lin=[]; w=0; }
            while(resto){ let k=resto.length; while(k>1&&doc.getTextWidth(resto.slice(0,k))>larg) k--; const q={...p,t:resto.slice(0,k),esp:false}; q.w=doc.getTextWidth(q.t); resto=resto.slice(k); if(resto){ out.push([q]); } else { q.esp=p.esp; lin=[q]; w=q.w; } }
            return; }
          if(nw>larg&&lin.length){ out.push(lin); lin=[p]; w=p.w; } else { lin.push(p); w=nw; } });
        if(lin.length) out.push(lin); return out; }
      function escreverLinha(lin,x,yy,larg,al,ultima,tamBase,corBase){
        const soma=lin.reduce((a,p)=>a+p.w,0), nEsp=lin.slice(0,-1).filter(p=>p.esp).length, espN=lin.slice(0,-1).reduce((a,p)=>a+(p.esp?p.e:0),0);
        let gap=null; if(al==="j"&&!ultima&&nEsp>0){ gap=(larg-soma)/nEsp; const e0=lin[0].e||2.5; if(gap>e0*3.2) gap=null; } // evita espaços enormes em linhas curtas
        let cx=x; const tw=soma+espN; if(al==="c") cx=x+(larg-tw)/2; else if(al==="r") cx=x+larg-tw;
        lin.forEach((p,k)=>{ fonte(p.b,p.s||tamBase); corT(p.c||corBase); doc.text(p.t,cx,yy); cx+=p.w+(k<lin.length-1&&p.esp?(gap!=null?gap:p.e):0); });
      }
      function paragrafo(b){
        const tam=b.s||9, lh=tam*(b.lh||1.55), ind=b.ind||0, larg=CW-ind;
        if(b.pb&&y>TOP) novaPag();
        y+=b.sb||0; const ls=linhas(b.runs,larg,tam); const altura=ls.length*lh;
        if(b.keep) garantir(Math.min(altura+80,LIM-TOP)); else garantir(Math.min(lh*2,altura));
        if(b.mark){ garantir(lh); fonte(true,tam); corT(b.markCor||COR.wine); doc.text(b.mark,ML+ind-(b.markW||12),y+tam); }
        ls.forEach((lin,i)=>{ if(garantir(lh)&&b.mark&&i===0){} escreverLinha(lin,ML+ind,y+tam,larg,b.al||"j",i===ls.length-1,tam,b.c||COR.ink); y+=lh; });
        y+=b.sa!=null?b.sa:6;
      }
      // V 1.30: titulos no padrao ElevaLife (1. Titulo com fio vinho; 1.1 Subtitulo; 1.1.1 em vinho escuro)
      function titulo(b){
        const PAD=window.BI&&BI.LaudoPadrao?BI.LaudoPadrao.PAL:null, vinhoM=PAD?"A34E56":COR.mid;
        if(b.pb&&y>TOP) novaPag(); else if(b.l===0){ if(y>TOP) y+=14; garantir(70); } else if(b.l===1){ y+=9; garantir(48); } else { y+=8; garantir(40); }
        if(b.toc){ tocPos.push(pag); if(final){ try{ doc.outline.add(null,b.x,{pageNumber:pag}); }catch{} } }
        const tam=b.l===0?15:b.l===1?11.5:10.5; fonte(true,tam,b.l<2); corT(b.l===0?COR.wine:b.l===1?vinhoM:COR.deep);
        const ls=doc.splitTextToSize(b.x,CW); ls.forEach((t,i)=>{ doc.text(t,ML,y+tam); y+=tam*1.25; });
        if(b.l===0){ y+=3; corL(COR.wine,1.2); doc.line(ML,y,ML+CW,y); y+=14; } else y+=b.l===1?5:3;
      }
      // V 1.30: assinaturas, ciencia do cliente e validacao por QR Code (padrao ElevaLife)
      function fechamento(b){ y=BI.LaudoPadrao.fechamento(doc,y,b,(yy,h)=>{ y=yy; garantir(h); return y; }); }
      function tabela(b){
        const tot=b.w.reduce((a,v)=>a+v,0), ws=b.w.map(v=>v/tot*CW), pad=4.5, padV=3;
        const medir=(row)=>{ let x=0, ci=0; return row.map(cel=>{ const span=cel.span||1, larg=ws.slice(ci,ci+span).reduce((a,v)=>a+v,0); ci+=span;
          const blocos=cel.p.map(pp=>{ const tam=pp.s||8.5; const ls=linhas(pp.runs,larg-pad*2,tam); return {pp,ls,tam,lh:tam*1.32}; });
          const h=blocos.reduce((a,bl)=>a+bl.ls.length*bl.lh+(bl.pp.sa||0),0)+padV*2; const r={cel,larg,blocos,h,x}; x+=larg; return r; }); };
        const linhasM=b.rows.map(medir).map((ms,i)=>({ms,cab:!!(b.hdr&&i===0),h:Math.max(b.hdr&&i===0?17:15,...ms.map(m=>m.h+(b.hdr&&i===0?2:0)))}));
        if(b.zebra!==false) linhasM.forEach((lm,i)=>{ if(lm.cab||i%2===(b.hdr?0:1)) return; lm.ms.forEach(m=>{ if(!m.cel.f) m.zebra=true; }); });
        const desenharLinha=(lm)=>{ let x=ML; lm.ms.forEach(m=>{ if(m.cel.f){ corF(m.cel.f); doc.rect(x,y,m.larg,lm.h,"F"); } else if(m.zebra){ corF("FBF7F5"); doc.rect(x,y,m.larg,lm.h,"F"); }
            let yy=y+padV; const hTxt=m.h-padV*2; if(!(b.va==="t"&&!lm.cab)) yy+=Math.max(0,(lm.h-padV*2-hTxt)/2);
            m.blocos.forEach(bl=>{ bl.ls.forEach((lin,i)=>{ escreverLinha(lin,x+pad,yy+bl.tam*.95,m.larg-pad*2,bl.pp.al||"l",true,bl.tam,bl.pp.c||m.cel.c||COR.ink); yy+=bl.lh; }); yy+=bl.pp.sa||0; });
            corL(COR.ln,.5); doc.rect(x,y,m.larg,lm.h,"S"); x+=m.larg; }); y+=lm.h; };
        const altTot=linhasM.reduce((a,l)=>a+l.h,0);
        if(b.keep&&altTot<LIM-TOP&&y+altTot>LIM) novaPag();
        const cab=b.hdr?linhasM[0]:null;
        if(cab&&linhasM[1]&&y+cab.h+linhasM[1].h>LIM) novaPag(); // cabeçalho nunca fica sozinho no fim da página
        linhasM.forEach((lm,i)=>{ if(y+lm.h>LIM){ novaPag(); if(cab&&i>0) desenharLinha(cab); } desenharLinha(lm); });
        y+=b.sa!=null?b.sa:8;
      }
      // V 1.34: grade de fotos (2 por linha) com legenda - laudo da AET
      function fotos(b){ const itens=(b.itens||[]).filter(f=>f&&f.d); if(!itens.length) return; const gap=10, w=(CW-gap)/2, hImg=b.alt||150;
        for(let k=0;k<itens.length;k+=2){ garantir(hImg+24); itens.slice(k,k+2).forEach((f,j)=>{ const x=ML+j*(w+gap); corF("FBF7F5"); doc.rect(x,y,w,hImg,"F"); corL(COR.ln,.5); doc.rect(x,y,w,hImg,"S");
            try{ const pr=doc.getImageProperties(f.d); let iw=w-8, ih=iw*pr.height/pr.width; if(ih>hImg-8){ ih=hImg-8; iw=ih*pr.width/pr.height; } doc.addImage(f.d,pr.fileType,x+(w-iw)/2,y+(hImg-ih)/2,iw,ih,undefined,"FAST"); }catch(e){ fonte(false,8); corT(COR.mut); doc.text("(imagem indisponível)",x+w/2,y+hImg/2,{align:"center"}); }
            if(f.leg){ fonte(false,7); corT(COR.mut); doc.text(doc.splitTextToSize(f.leg,w)[0],x,y+hImg+10); } });
          y+=hImg+20; } y+=4; }
      function imagem(b){ const w=Math.min(b.w,CW), h=b.h*(w/b.w); garantir(h+8); try{ doc.addImage(b.d,"PNG",ML+(CW-w)/2,y,w,h,undefined,"FAST"); }catch{} y+=h+8; }
      // V 1.30: sumario no padrao ElevaLife
      function sumario(){
        fonte(true,15,true); corT(COR.wine); doc.text("Sumário",ML,y+15); y+=22; corL(COR.wine,1.2); doc.line(ML,y,ML+CW,y); y+=26;
        const itens=opc.toc.map((t,i)=>({titulo:t.title,nivel:t.level,pagina:final?mapa.paginas[i]:0}));
        y=BI.LaudoPadrao.sumario(doc,itens,y,{links:final,proximaPagina:()=>{ novaPag(); return TOP+12; }}); }
      // ---- capa ----
      if(opc.capa){ BI.LaudoPadrao.capa(doc,opc.capa); novaPag(); }
      // ---- corpo ----
      blocos.forEach(b=>{ if(b.t==="fotos") fotos(b); else if(b.t==="p") paragrafo(b); else if(b.t==="h") titulo(b); else if(b.t==="tb") tabela(b); else if(b.t==="img") imagem(b); else if(b.t==="toc") sumario(); else if(b.t==="pb"){ if(y>TOP) novaPag(); } else if(b.t==="esp") { y+=b.h||8; } else if(b.t==="fech") fechamento(b); });
      // ---- cabeçalho e rodapé ----
      const total=doc.getNumberOfPages();
      if(final) BI.LaudoPadrao.cabecalhoRodape(doc,{logoCor:opc.logo,titulo:opc.cabecalho,codigo:opc.codigo,revisao:opc.revisao,rodape:opc.rodape,desde:opc.capa?2:1});
      return {doc,tocPos,total};
    };
    const p1=desenhar(false); mapa={paginas:p1.tocPos,total:p1.total};
    const p2=desenhar(true);
    const saida=p2.doc.output("blob"); try{ saida.totalPaginas=p2.total; }catch(e){}
    return saida;
  }
  
  
  BI.LaudoBlocos = { renderPDF, COR, PDFL, CW: 9354 };
})(window);
