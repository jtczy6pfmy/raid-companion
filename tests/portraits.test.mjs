import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const manifest=JSON.parse(readFileSync('site/portraits/manifest.json','utf8'));
test('portrait catalog contains real local files and resolves full champion names',async()=>{
 for(const file of Object.values(manifest.portraits))assert.ok(existsSync('site/portraits/'+file),file);
 const window={};
 const document={readyState:'complete',querySelectorAll:()=>[],getElementById:()=>null};
 vm.runInNewContext(readFileSync('site/portrait-loader.js','utf8'),{window,document,console,fetch:async()=>({ok:true,json:async()=>manifest})});
 await new Promise(r=>setImmediate(r));
 for(const name of ['Broadmaw','Arbiter','Ninja','Acelin the Stalwart','Stalwart (Copy 2)'])assert.ok(window.raidPortraitUrl(name),name);
 assert.equal(window.raidPortraitUrl('Cheshire Cat'),'./portraits/cheshire.webp');
 assert.equal(window.raidPortraitUrl('Unknown champion'),null);
});
