/* Exercise the shipped page handlers with a small DOM harness. This checks
   behavior and error recovery; it is not a visual rendering test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
class Element {
  constructor() { this.hidden=false; this.value=''; this.children=[]; this.handlers={}; this.textContent=''; this.className=''; this.open=false; this.fields={}; this.classList={add: x=>{this.className+=' '+x;}}; }
  addEventListener(name, fn) { this.handlers[name]=fn; }
  append(...values) { this.children.push(...values); }
  replaceChildren(...values) { this.children=values; }
  setAttribute() {}
  focus() {}
  scrollIntoView() {}
  async fire(name) { return this.handlers[name]?.({preventDefault(){},currentTarget:this}); }
}
const daily = {date:'2026-10-07',center:'a',outer:[...'bdflor']};
const species = {pokemon:[{id:63,name:'Abra'},{id:151,name:'Mew'},{id:250,name:'Ho-Oh'},{id:133,name:'Eevee'},{id:233,name:'Porygon2'}]};
const settle = () => new Promise(resolve => setImmediate(resolve));
async function harness({failDaily=false,badDaily=false,storage=new Map()}={}) {
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  assert.equal(new Set(Object.keys(elements)).size,[...html.matchAll(/\bid="([^"]+)"/g)].length,'HTML IDs must be unique');
  const context = {
    document:{getElementById:id=>{assert.ok(elements[id],`Missing HTML element ${id}`);return elements[id];},createElement:()=>new Element()},
    fetch:async url=>{
      if(url.startsWith('data/pokemon'))return {ok:true,json:async()=>species};
      if(url.startsWith('data/daily'))return {ok:!failDaily,json:async()=>badDaily?{...daily,outer:[...'abcdef']}:daily};
      throw new Error('Unexpected request '+url);
    },
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    Intl,Date,console,Set,Map,JSON,FormData:class{constructor(form){this.fields=form.fields;}get(key){return this.fields[key];}},
    location:{origin:'https://example.test',pathname:'/bee/'},navigator:{clipboard:{writeText:async text=>{context.clipboardText=text;}}},
    window:{isSecureContext:true,prompt(){}},
  };
  vm.createContext(context); vm.runInContext(core,context); vm.runInContext(script,context); await settle();
  return {elements,storage,context};
}
(async()=>{
  const {elements:e,storage,context}=await harness();
  assert.equal(e.outcome.textContent,'YES.'); assert.equal(e.hive.children.length,7);
  assert.equal(e['guess-form'].hidden,false); assert.equal(e.revealed.hidden,true);
  e.guess.value='Abra';await e['guess-form'].fire('submit');
  assert.match(e.feedback.textContent,/Abra.*found/); assert.equal(e['found-list'].children.length,1);
  e.guess.value='abra';await e['guess-form'].fire('submit');assert.match(e.feedback.textContent,/already found/);
  e.guess.value='Mew';await e['guess-form'].fire('submit');assert.match(e.feedback.textContent,/too short/);
  e.guess.value='Porygon2';await e['guess-form'].fire('submit');assert.match(e.feedback.textContent,/digits/);
  e.guess.value='Eevee';await e['guess-form'].fire('submit');assert.match(e.feedback.textContent,/isn’t in the hive/);
  await e.reveal.fire('click'); assert.equal(e.revealed.hidden,false);
  await e.share.fire('click');assert.ok(!context.clipboardText.includes('Abra'));assert.match(context.clipboardText,/answers revealed/);
  const restored=await harness({storage});assert.match(restored.elements.progress.textContent,/1 of 1/);assert.equal(restored.elements.revealed.hidden,false);
  e['manual-form'].fields={center:'f',outer:'a b d l o r'};await e['manual-form'].fire('submit');assert.equal(e.outcome.textContent,'ALMOST.');
  e.guess.value='Abra';await e['guess-form'].fire('submit');assert.match(e.feedback.textContent,/skips F/);
  e['manual-form'].fields={center:'k',outer:'l m n p s t'};await e['manual-form'].fire('submit');assert.equal(e.outcome.textContent,'NO.');assert.equal(e['guess-form'].hidden,true);
  await e['back-daily'].fire('click');assert.equal(e.outcome.textContent,'YES.');
  e['manual-form'].fields={center:'a',outer:'a b c d e f'};await e['manual-form'].fire('submit');assert.match(e['manual-feedback'].textContent,/different/);assert.equal(e.outcome.textContent,'YES.');
  for (const options of [{failDaily:true},{badDaily:true}]) {
    const broken=await harness(options);assert.ok(broken.elements['load-message'].textContent.length>0);
    broken.elements['manual-form'].fields={center:'a',outer:'b d f l o r'};
    await broken.elements['manual-form'].fire('submit');assert.equal(broken.elements.outcome.textContent,'YES.');
  }
  console.log('Interface handlers passed: guessing, reveals, sharing, restored progress, all outcomes, invalid input, and failed daily-data recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
