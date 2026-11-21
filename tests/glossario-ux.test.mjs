import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('arquivo-app.js');
const start=app.indexOf('/* Navegação do glossário: filtros combináveis');
const end=app.indexOf('function grimorioBanner(){',start);
const snippet=app.slice(start,end);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
function setup(){
 const items=[
  {name:'Alma',category:'Recursos',description:'Alma é o recurso utilizado em muitas técnicas. Permite ativar habilidades e controlar efeitos.',chapterTitle:'Recursos',source:'automatic'},
  {name:'Reação',category:'Combate',description:'Uma reação se utiliza diante de um gatilho válido, respeitando o limite da rodada.',chapterTitle:'Combate',source:'manual'},
  {name:'Dano-base',category:'Combate',description:'Use o dado apropriado e calcule o dano-base respeitando as regras oficiais.',chapterTitle:'Combate',source:'automatic'},
  {name:'Fortitude',category:'Testes',description:'Perícia para resistir e enfrentar ameaças.',chapterTitle:'Perícias',source:'automatic'},
  {name:'Teste de <script>',category:'Testes',description:'Teste <> inseguro',chapterTitle:'Perícias',source:'manual'}
 ];
 const storage=new Map(),local={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const ctx=vm.createContext({
  DATASTORE:{local},
  grimorioCatalogEntries:()=>items,
  glossaryKey:fold,
  GRIMORIO_CATEGORIES:['Recursos','Testes','Combate','Condições','Recuperação','Outros'],
  grimorioQuery:'',grimorioCategory:'Todos',grimorioLetter:'Todas',grimorioFavoritesOnly:false,grimorioSelectedTerm:'',
  esc,master:()=>false,btn:()=>'',el:()=>null,grimorioRefreshResults:()=>{}
 });
 vm.runInContext(snippet,ctx);
 const run=code=>vm.runInContext(code,ctx);
 return {run,storage,items};
}
test('Glossário abre como consulta principal, sem busca de capítulos duplicada',()=>{
 assert.ok(start>0&&end>start);
 assert.match(app,/libraryMode='glossary'/);
 assert.match(app,/if\(libraryMode==='glossary'\)return headline/);
 assert.match(app,/data-action="libraryMode:chapters"/);
 assert.match(app,/data-action="libraryMode:glossary"/);
 const glossaryBranch=app.slice(app.indexOf("if(libraryMode==='glossary')return headline"),app.indexOf("return headline(",app.indexOf("if(libraryMode==='glossary')return headline")+38));
 assert.doesNotMatch(glossaryBranch,/id="ruleSearch"|id="ruleResults"/);
 const html=read('index.html');
 assert.match(html,/glossario-ux\.css\?v=1/);
 assert.match(html,/biblioteca-redesign\.css\?v=1/);
 assert.ok(html.indexOf('glossario-ux.css')<html.indexOf('biblioteca-redesign.css'));
});
test('categorias e índice A-Z refinam os resultados sem alterar os verbetes',()=>{
 const {run,items}=setup(),before=JSON.stringify(items);
 let page=run('grimorioPanel()');
 assert.match(page,/EXPLORAR POR ASSUNTO/);
 assert.match(page,/ÍNDICE A–Z/);
 assert.match(page,/data-action="grimorioCategoryFilter:Combate"/);
 assert.match(page,/data-action="grimorioLetter:R"/);
 assert.match(page,/5 resultado/);
 run('grimorioCategory="Combate";grimorioLetter="R"');
 const markup=run('grimorioResultsMarkup()');
 assert.match(markup,/Reação/);
 assert.doesNotMatch(markup,/Dano-base/);
 assert.equal(JSON.stringify(items),before);
});
test('busca encontra termos no texto e nomes com e sem acento',()=>{
 const {run}=setup();
 run('grimorioQuery="alma"');
 let page=run('grimorioResultsMarkup()');
 assert.match(page,/Alma/);
 assert.doesNotMatch(page,/Fortitude/);
 run('grimorioQuery="reacao"');
 page=run('grimorioResultsMarkup()');
 assert.match(page,/Reação/);
});
test('favoritos são persistidos no navegador e não alteram as regras',()=>{
 const {run,storage,items}=setup(),before=JSON.stringify(items);
 run('toggleGrimorioFavorite("Alma")');
 assert.match(storage.get('ae_grimorio_favoritos_v1'),/alma/);
 run('grimorioFavoritesOnly=true');
 let html=run('grimorioResultsMarkup()');
 assert.match(html,/Alma/);
 assert.doesNotMatch(html,/Reação/);
 run('toggleGrimorioFavorite("Alma")');
 html=run('grimorioResultsMarkup()');
 assert.match(html,/Nenhum verbete encontrado/);
 assert.equal(JSON.stringify(items),before);
});
test('nome e prévia de verbete são escapados em ambos os modos',()=>{
 const {run}=setup(),html=run('grimorioResultsMarkup()');
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/Teste de &lt;script&gt;/);
 assert.match(html,/data-action="grimorioFavorite:/);
 assert.match(html,/data-action="grimorioSelect:/);
});

test('Consulta rápida mostra resposta inteira na mesma página e permite abrir o capítulo',()=>{
 const {run}=setup();
 const markup=run('grimorioPanel()');
 assert.match(markup,/id="grimorioSearch"/);
 assert.match(markup,/id="grimorioDetail"/);
 assert.match(markup,/class="ae-glossary-answer-layout"/);
 assert.match(markup,/<details class="ae-glossary-advanced">/);
 assert.ok(markup.indexOf('id="grimorioResults"')>markup.indexOf('id="grimorioSearch"'));
 const detail=run('grimorioDetailMarkup()');
 assert.match(detail,/Alma é o recurso utilizado/);
 assert.match(detail,/DEFINIÇÃO/);
});
test('Clique em outro termo mostra a definição sem modal e busca privilegia título',()=>{
 const {run}=setup();
 run('selectGrimorioEntry("Rea%C3%A7%C3%A3o")');
 const detail=run('grimorioDetailMarkup()');
 assert.match(detail,/Uma reação se utiliza/);
 assert.doesNotMatch(detail,/Alma é o recurso/);
 run('grimorioQuery="dano"');
 const order=run('grimorioFilteredEntries().map(item=>item.name)');
 assert.equal(order[0],'Dano-base');
});
test('Conteúdo do glossário é escapado na leitura detalhada',()=>{
 const {run}=setup();
 run('selectGrimorioEntry("Teste%20de%20%3Cscript%3E")');
 const detail=run('grimorioDetailMarkup()');
 assert.match(detail,/Teste de &lt;script&gt;/);
 assert.doesNotMatch(detail,/<script>/);
});
