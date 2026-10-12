const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

module.exports=async function(test){
  const root=path.resolve(__dirname,"..");
  const source=fs.readFileSync(path.join(root,"index.html"),"utf8");
  new (require("node:vm").Script)(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
  const html=source.replace("<head>",'<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'none\'; connect-src \'self\'">').replace(/<link[^>]*https:\/\/fonts[^>]*>/g,"").replace("init();\n</script>",()=>`(${test.toString()})();\n</script>`);
  const server=http.createServer((req,res)=>{
    if(req.url.startsWith("/__test")){ res.setHeader("Content-Type","text/html; charset=utf-8"); res.end(html); return; }
    const file=path.join(root,new URL(req.url,"http://localhost").pathname);
    fs.readFile(file,(error,data)=>{ res.statusCode=error?404:200; res.end(error?"Not found":data); });
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    for(const args of [["--window-size=1280,900"],["--window-size=500,844","--force-prefers-reduced-motion=reduce"],["--window-size=600,480"]]){
      const profile=fs.mkdtempSync(path.join(os.tmpdir(),"biblioteca-test-"));
      try{
        const result=await new Promise((resolve,reject)=>{
          const child=spawn("chromium",["--headless=new","--no-sandbox","--disable-gpu","--disable-background-networking",`--user-data-dir=${profile}`,"--virtual-time-budget=20000","--dump-dom",...args,`http://127.0.0.1:${server.address().port}/__test`]);
          let stdout="",stderr="";
          child.stdout.on("data",data=>stdout+=data);
          child.stderr.on("data",data=>stderr+=data);
          const timer=setTimeout(()=>child.kill("SIGKILL"),45000);
          child.on("error",error=>{ clearTimeout(timer); reject(error); });
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
  }finally{
    server.close();
  }
};
