/* Validação sem dependências da estrutura estática publicada no GitHub Pages. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const fail=[];
const assets=new Map();
const references=[];
const scriptRE=/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g;
const styleRE=/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g;
const readReferences=(re,kind)=>{
 for(const match of html.matchAll(re)){
  const href=match[1];
  if(/^https?:\/\//.test(href)){references.push({kind,href,external:true});continue}
  const local=href.split(/[?#]/)[0];
  const file=path.resolve(root,local);
  if(!file.startsWith(root+path.sep))fail.push('Recurso fora do projeto: '+href);
  else if(!fs.existsSync(file))fail.push('Arquivo não encontrado: '+href);
  else if(fs.statSync(file).size===0)fail.push('Arquivo vazio: '+href);
  if((kind==='script'||kind==='css')&&!href.includes('?'))fail.push('Sem versão de cache: '+href);
  const key=kind+':'+local;
  if(assets.has(key))fail.push('Referência duplicada: '+href);
  assets.set(key,(assets.get(key)||0)+1);
  references.push({kind,href,local,bytes:fs.existsSync(file)?fs.statSync(file).size:0});
 }
};
readReferences(styleRE,'css');
readReferences(scriptRE,'script');
const scriptNames=references.filter(r=>r.kind==='script').map(r=>r.local||r.href);
for(const [first,second] of [['dados.js','arquivo-app.js'],['configuracao.js','online.js'],['online.js','arquivo-app.js']]){
 if(scriptNames.indexOf(first)<0||scriptNames.indexOf(second)<0||
    scriptNames.indexOf(first)>=scriptNames.indexOf(second))
  fail.push('Ordem de dependência incorreta: '+first+' antes de '+second);
}
if(/site-update\.js|site-version\.json|ae-site-update-overlay/i.test(html))fail.push('Aviso de versão removido foi reinserido.');
const jsCss=fs.readdirSync(root).filter(n=>/\.(?:js|css)$/.test(n));
const orphans=jsCss.filter(n=>!references.some(ref=>ref.local===n));
const total=references.filter(r=>r.local).reduce((a,r)=>a+r.bytes,0);
const lines=[
 'Arquivos JS/CSS carregados: '+references.filter(r=>r.local).length,
 'Tamanho bruto dos arquivos carregados (sem compressão): '+(total/1024).toFixed(1)+' KiB',
 'Arquivos JS/CSS não referenciados diretamente: '+(orphans.join(', ')||'nenhum')
];
if(process.argv.includes('--report'))console.log(lines.join('\n'));
if(fail.length){for(const error of fail)console.error('ERRO: '+error);process.exitCode=1;}
else console.log('Integridade dos recursos estáticos: OK');
