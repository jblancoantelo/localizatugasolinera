const http=require('http'),fs=require('fs'),path=require('path');
const r=path.join(__dirname,'..');
const t={'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};
http.createServer((q,s)=>{let u=q.url.split('?')[0],p=u==='/'?path.join(r,'index.html'):path.join(r,u);fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);s.end('NF')}else{s.writeHead(200,{'Content-Type':t[path.extname(p)]||'octet/stream'});s.end(d)}})}).listen(8080,()=>{});
