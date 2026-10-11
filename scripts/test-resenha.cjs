const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
new (require("node:vm").Script)(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
const test = async function(){
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=(value,message)=>{ if(!value) throw new Error(message); };
  const errors=[];
  window.addEventListener("error",e=>errors.push(e.message));
  window.addEventListener("unhandledrejection",e=>errors.push(String(e.reason)));
  try{
    await sleep(1200);
    registerSW=async()=>{};
    pullSync=async()=>{};
    loadCatalog=async()=>{};
    loadData=async()=>{};
    const saved=new Map();
    putOf=async(name,value)=>saved.set(`${name}:${value.id}`,structuredClone(value));
    allOf=async(name)=>[...saved.entries()].filter(([key])=>key.startsWith(name+":")).map(([,value])=>value);
    await init();
    BOOKS=[{id:"__resenha_test__",title:"Livro <teste> & companhia",author:"Teste",resenha:"Uma resenha & <texto> original.",citacoes:[],nota:0,status:"Lendo",cover:"/missing-cover.png"}];
    META={};
    await putOf("books",BOOKS[0]);
    renderDiary();
    document.querySelector(".coverbtn").click();
    await sleep(1300);
    let book=document.querySelector("#flipview .flip-book");
    check(book&&book.classList.contains("flipped"),"A capa não virou");
    check(document.querySelector("#flipview .fallback"),"Capa de reserva ausente");
    check(document.querySelector("#flipview .rv").textContent===BOOKS[0].resenha,"Resenha da contracapa alterada");
    const edit=document.querySelector("#flipview .edit-review");
    check(edit,"Botão de editar na contracapa ausente");
    edit.click();
    check(document.querySelector("#caderno .cad-cover")===book,"Livro não foi transferido para o caderno");
    check(!document.querySelector("#flipview").classList.contains("open"),"Contracapa continua aberta");
    await sleep(1300);
    document.querySelector("#caderno").getAnimations({subtree:true}).forEach(animation=>animation.finish());
    const coverRect=book.getBoundingClientRect();
    check(coverRect.top>=0&&coverRect.top<innerHeight/2&&coverRect.width<=60,"Livro não subiu para o topo do caderno");
    const textarea=document.querySelector("#cadTxt");
    check(document.activeElement===textarea,"Editor sem foco");
    check(textarea.value===BOOKS[0].resenha,"Texto original alterado");
    check(getComputedStyle(textarea).fontFamily.includes("monospace"),"Fonte de máquina de escrever ausente");
    const rect=document.querySelector("#caderno .caderno").getBoundingClientRect();
    check(rect.left>=0&&rect.right<=innerWidth+1&&rect.top>=0&&rect.bottom<=innerHeight+1,`Caderno fora da tela: ${JSON.stringify(rect.toJSON())}, viewport ${innerWidth}x${innerHeight}`);
    const sound=document.querySelector("#cadSound");
    check(sound.getAttribute("aria-pressed")==="false","Som deve começar desligado");
    const NativeAudio=window.AudioContext;
    let played=0;
    window.AudioContext=class{
      constructor(){ this.state="suspended"; this.sampleRate=8000; this.currentTime=0; }
      async resume(){ this.state="running"; }
      async close(){ this.state="closed"; }
      createBuffer(channels,length){ return {getChannelData:()=>new Float32Array(length)}; }
      createBufferSource(){ return {connect(){},disconnect(){},start(){ played++; this.onended(); }}; }
      createBiquadFilter(){ return {connect(){},disconnect(){},frequency:{value:0}}; }
      createGain(){ return {connect(){},disconnect(){},gain:{value:0}}; }
    };
    sound.click();
    await sleep(10);
    check(sound.getAttribute("aria-pressed")==="true","Som não ativou");
    const audio=reviewAudio;
    textarea.value="Minha nova resenha.\nSegunda linha & <texto>.";
    textarea.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:"."}));
    check(document.querySelector(".cad-writing").classList.contains("typing"),"Impacto da digitação ausente");
    check(played===1,"Tecla não emitiu som");
    sound.click();
    textarea.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:"."}));
    check(played===1,"Som continuou após desligar");
    const persist=putOf;
    putOf=async()=>{ throw new Error("Falha simulada"); };
    await saveCaderno(BOOKS[0].id);
    check(document.querySelector("#caderno").classList.contains("open")&&!document.querySelector("#cadSave").disabled,"Falha de gravação fechou ou bloqueou o editor");
    putOf=persist;
    textarea.focus();
    document.querySelector("#caderno").dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true}));
    check(document.activeElement===document.querySelector("#cadSave"),"Foco saiu do caderno");
    await saveCaderno(BOOKS[0].id);
    check((await allOf("books")).find(b=>b.id===BOOKS[0].id).resenha===textarea.value,"Resenha não persistida");
    check(!document.querySelector("#caderno").classList.contains("open"),"Caderno não fechou após salvar");
    check(audio.state==="closed"&&reviewAudio===null,"Áudio não foi liberado");
    window.AudioContext=NativeAudio;
    openFlip(BOOKS[0].id);
    await sleep(1300);
    document.querySelector("#flipview .edit-review").click();
    document.querySelector("#cadTxt").value="Não salvar";
    document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
    await sleep(1300);
    check(!document.querySelector("#caderno").classList.contains("open"),"Escape não fechou o caderno");
    check(document.body.style.overflow==="","Rolagem não restaurada");
    check(BOOKS[0].resenha===textarea.value,"Cancelar alterou a resenha");
    openFlip(BOOKS[0].id);
    closeFlip();
    await sleep(1400);
    check(!document.querySelector("#caderno").classList.contains("open"),"Timer reabriu editor fechado");
    openCaderno(BOOKS[0].id);
    await sleep(1300);
    document.querySelector("#caderno").click();
    check(!document.querySelector("#caderno").classList.contains("open"),"Fundo não fechou editor");
    check(errors.length===0,errors.join("; "));
    document.body.innerHTML='<pre id="testout">'+JSON.stringify({ok:true,width:innerWidth,reduced:matchMedia("(prefers-reduced-motion: reduce)").matches})+'</pre>';
  }catch(error){
    document.body.innerHTML='<pre id="testout">'+JSON.stringify({ok:false,error:error.message,errors})+'</pre>';
  }
};
const html=source.replace("<head>",'<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'none\'; connect-src \'self\'">').replace(/<link[^>]*https:\/\/fonts[^>]*>/g,"").replace("init();\n</script>",`(${test.toString()})();\n</script>`);
const server=http.createServer((req,res)=>{
  if(req.url.startsWith("/__test")){ res.setHeader("Content-Type","text/html; charset=utf-8"); res.end(html); return; }
  const file=path.join(root,new URL(req.url,"http://localhost").pathname);
  fs.readFile(file,(error,data)=>{ res.statusCode=error?404:200; res.end(error?"Not found":data); });
});
async function run(args){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),"biblioteca-resenha-"));
  try{
    const result=await new Promise((resolve,reject)=>{
      const child=spawn("chromium",["--headless=new","--no-sandbox","--disable-gpu","--disable-background-networking",`--user-data-dir=${profile}`,"--virtual-time-budget=16000","--dump-dom",...args,`http://127.0.0.1:${server.address().port}/__test`]);
      let stdout="",stderr="";
      child.stdout.on("data",data=>stdout+=data);
      child.stderr.on("data",data=>stderr+=data);
      const timer=setTimeout(()=>child.kill("SIGKILL"),45000);
      child.on("error",reject);
      child.on("close",code=>{ clearTimeout(timer); code===0?resolve(stdout):reject(new Error(`Chromium ${code}: ${stderr.slice(-1500)}`)); });
    });
    const match=result.match(/<pre id="testout">(\{[^<]*)<\/pre>/);
    assert.ok(match,`Resultado do teste ausente: ${result.slice(-1500)}`);
    const out=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&"));
    assert.equal(out.ok,true,JSON.stringify(out));
    console.log(JSON.stringify(out));
  }finally{
    fs.rmSync(profile,{recursive:true,force:true});
  }
}
server.listen(0,"127.0.0.1",async()=>{
  try{
    await run(["--window-size=1280,900"]);
    await run(["--window-size=500,844","--force-prefers-reduced-motion=reduce"]);
    await run(["--window-size=600,480"]);
  }catch(error){ console.error(error); process.exitCode=1; }
  finally{ server.close(); }
});
