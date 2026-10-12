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
    const saved=new Map();
    putOf=async(name,value)=>saved.set(`${name}:${value.id??value.k}`,structuredClone(value));
    persistReading=async(books,entry)=>{ for(const b of books) await putOf("books",b); if(entry) await putOf("diary",entry); };
    await init(); META={};
    BOOKS=[{id:"read",title:"Livro já lido",author:"Lia",status:"Lido",genero:"Fantasia",paginas:80,paginasLidas:80,resenha:"Resenha preservada",citacoes:[{id:"quote",text:"Citação",page:7}]},{id:"active",title:"Livro atual",author:"Ana",status:"Quero ler",genero:"Fantasia",paginas:100,paginasLidas:0,citacoes:[]},{id:"automatic",title:"Livro curto",author:"Ana",status:"Lendo",genero:"Romance",paginas:10,paginasLidas:0,citacoes:[]},...Array.from({length:20},(_,i)=>({id:`read-${i}`,title:`Concluído ${i}`,status:"Lido",genero:"Fantasia",citacoes:[]}))];
    for(const b of BOOKS) await putOf("books",b);
    renderFilters(); renderShelves();
    const readGroup=()=>document.querySelector('[data-shelf-group="read"]');
    const activeGroup=()=>document.querySelector('[data-shelf-group="active"]');
    const count=()=>document.querySelectorAll("#shelves .book-card").length;
    check(readGroup()&&activeGroup(),"Estante não separa livros lidos");
    check(document.querySelector("#shelves").lastElementChild===readGroup(),"Prateleiras de lidos não estão no final");
    check(readGroup().querySelectorAll(".book-card").length===21&&activeGroup().querySelectorAll(".book-card").length===2,"Livro foi colocado no grupo errado");
    check(readGroup().querySelectorAll(".shelf").length>=2,"Muitos livros lidos não foram distribuídos em prateleiras");
    check(count()===23&&new Set([...document.querySelectorAll("#shelves .book-card")].map(el=>el.dataset.id)).size===23,"Há livros duplicados");
    const read=BOOKS.find(b=>b.id==="read"),before=JSON.stringify(read);
    document.querySelector('.book-card[data-id="read"]').click();
    check(document.querySelector("#bId").value==="read"&&document.querySelector("#bStatus").value==="Lido","Livro lido não abre o mesmo modal");
    check(JSON.stringify(read)===before,"Abrir livro lido mudou seus dados");
    document.querySelector("#bStatus").value="Lendo";
    await saveBook(document.querySelector("#panel"),read.id); await sleep(600);
    check(activeGroup().querySelector('[data-id="read"]')&&!readGroup().querySelector('[data-id="read"]'),"Livro não voltou à estante principal");
    check(BOOKS[0].resenha==="Resenha preservada"&&BOOKS[0].citacoes.length===1&&BOOKS[0].paginasLidas===80,"Trocar prateleira apagou dados");
    document.querySelector('.book-card[data-id="active"]').click();
    document.querySelector("#bStatus").value="Lido";
    await saveBook(document.querySelector("#panel"),"active"); await sleep(600);
    check(readGroup().querySelector('[data-id="active"]'),"Marcar Lido não moveu para o final");
    document.querySelector('.book-card[data-id="automatic"]').click();
    document.querySelector("#bPagesLidas").value="10";
    await saveBook(document.querySelector("#panel"),"automatic"); await sleep(600);
    check(BOOKS.find(b=>b.id==="automatic").status==="Lido"&&readGroup().querySelector('[data-id="automatic"]'),"Concluir páginas não moveu automaticamente o livro");
    fdStatus="Lido"; renderFilters(); renderShelves();
    check(!activeGroup()&&readGroup()&&count()===22,"Filtro Lido deixa prateleiras principais vazias ou perde livros");
    const genre=document.querySelector("#genreSelect"); genre.value=[...genre.options].find(o=>o.textContent==="Romance").value; genre.dispatchEvent(new Event("change",{bubbles:true}));
    check(count()===1&&readGroup().querySelector('[data-id="automatic"]'),"Filtro de gênero não se aplica aos lidos");
    document.querySelector("#filterSearch").value="não existe";
    document.querySelector("#filterSearch").dispatchEvent(new Event("input",{bubbles:true}));
    check(count()===0&&!readGroup()&&!activeGroup()&&!document.querySelector("#empty").hidden,"Sem resultados deixa prateleiras vazias");
    fdStatus="Lendo"; fdGenre="todos"; fdSearch=""; renderFilters(); renderShelves();
    check(activeGroup()&&!readGroup()&&count()===1,"Filtro sem livros lidos deixou a seção vazia");
    check(BOOKS.length===23&&saved.get("books:read").citacoes.length===1,"Organização removeu ou duplicou os dados armazenados");
    check(errors.length===0,errors.join("; "));
    document.body.innerHTML='<pre id="testout">'+JSON.stringify({ok:true,test:"estante",width:innerWidth})+'</pre>';
  }catch(error){
    document.body.innerHTML='<pre id="testout">'+JSON.stringify({ok:false,error:error.message,errors})+'</pre>';
  }
};
runBrowserTest(test).catch(error=>{ console.error(error); process.exitCode=1; });
