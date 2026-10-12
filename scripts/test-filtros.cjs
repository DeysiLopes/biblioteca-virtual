const runBrowserTest=require("./browser-test.cjs");

const test=async function(){
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=(value,message)=>{ if(!value) throw new Error(message); };
  const errors=[];
  window.addEventListener("error",e=>errors.push(e.message));
  window.addEventListener("unhandledrejection",e=>errors.push(String(e.reason)));
  try{
    await sleep(1200);
    registerSW=async()=>{}; pullSync=async()=>{}; loadCatalog=async()=>{}; loadData=async()=>{};
    await init(); META={};
    BOOKS=[{id:"a",title:"Coração em Chamas",author:"Ana",status:"Lendo",genero:"Fantasia",paginas:100,paginasLidas:30,citacoes:[]},{id:"b",title:"Calma",author:"Ana",status:"Quero ler",genero:"Romance",citacoes:[]},{id:"c",title:"Noite",author:"Bia",status:"Lido",genero:[" fantasia ","Ficção científica"],citacoes:[]},{id:"d",title:"Pesquisa",author:"Lia",status:"Abandonado",genero:null,citacoes:[]},{id:"e",title:"Outro",author:"Ana",status:"Lendo",genero:"FANTASIA; Ficção científica",citacoes:[]}];
    const original=JSON.stringify(BOOKS);
    renderFilters(); renderShelves();
    const select=document.querySelector("#genreSelect");
    if(select){ select.value=[...select.options].find(o=>o.textContent==="Fantasia").value; select.dispatchEvent(new Event("change",{bubbles:true})); }
    else [...document.querySelectorAll("#filters .pill")].find(p=>p.textContent==="Fantasia").click();
    check(visibleBooks().some(b=>b.id==="a"),"Selecionar gênero não encontra nem o livro com gênero exato");
    check(document.querySelector("#genreSelect")?.tagName==="SELECT","Gênero não virou dropdown");
    const labels=[...document.querySelector("#genreSelect").options].map(o=>o.textContent);
    check(labels[0]==="Todos os gêneros"&&labels.filter(x=>norm(x)==="fantasia").length===1,"Dropdown não tem Todos ou duplica gêneros equivalentes");
    check(visibleBooks().map(b=>b.id).join(",")==="a,c,e","Filtro não trata lista, espaços ou diferenças de maiúsculas");
    [...document.querySelectorAll("#filters .pill")].find(p=>p.textContent==="Lendo").click();
    check(visibleBooks().map(b=>b.id).join(",")==="a,e","Filtro de status não combina com o gênero");
    const chosen=document.querySelector("#genreSelect").value;
    const search=document.querySelector("#filterSearch");
    check(search,"Busca para combinar com filtros ausente");
    search.value="coracao"; search.dispatchEvent(new Event("input",{bubbles:true}));
    check(visibleBooks().map(b=>b.id).join(",")==="a","Busca não normaliza acentos");
    search.value="Noite"; search.dispatchEvent(new Event("input",{bubbles:true}));
    check(visibleBooks().length===0&&!document.querySelector("#empty").hidden,"Sem resultados não tem estado vazio");
    [...document.querySelectorAll("#filters .pill")].find(p=>p.textContent==="Todos").click();
    check(visibleBooks().map(b=>b.id).join(",")==="c"&&document.querySelector("#genreSelect").value===chosen,"Mudar status perdeu gênero ou busca");
    document.querySelector("#filterSearch").value="";
    document.querySelector("#filterSearch").dispatchEvent(new Event("input",{bubbles:true}));
    const genre=document.querySelector("#genreSelect"); genre.value="todos"; genre.dispatchEvent(new Event("change",{bubbles:true}));
    check(visibleBooks().length===5,"Todos os gêneros não inclui livros sem gênero");
    document.querySelector("#filterSearch").value="Bia";
    document.querySelector("#filterSearch").dispatchEvent(new Event("input",{bubbles:true}));
    check(visibleBooks().map(b=>b.id).join(",")==="c","Busca por autor não funciona");
    renderFilters();
    check(document.querySelector("#filterSearch").value==="Bia","Atualizar filtros perdeu a busca");
    check(JSON.stringify(BOOKS)===original,"Filtrar alterou os dados dos livros");
    check(errors.length===0,errors.join("; "));
    document.body.innerHTML='<pre id="testout">'+JSON.stringify({ok:true,test:"filtros",width:innerWidth})+'</pre>';
  }catch(error){
    document.body.innerHTML='<pre id="testout">'+JSON.stringify({ok:false,error:error.message,errors})+'</pre>';
  }
};
runBrowserTest(test).catch(error=>{ console.error(error); process.exitCode=1; });
