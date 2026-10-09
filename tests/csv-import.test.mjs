import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,planImport} from '../site/csv-import.js';

test('quoted CSV handles commas, escaped quotes, line breaks and BOM',()=>{
 const [row]=parseCSV('\uFEFFName,Rank,Level,Notes\r\n"Champion, A",3,30,"Use ""speed""\nboots"\r\n');
 assert.equal(row.name,'Champion, A');assert.equal(row.values.Notes,'Use "speed"\nboots');
});
test('invalid records stop the import instead of silently dropping rows',()=>{
 for(const csv of ['Name,Rank,Level\nA,4,50','Name,Rank,Level\nA,4','Name,Name,Rank,Level\nA,A,4,40','Name,Rank,Level\n"A,4,40','Name,Rank,Level,Ascension\nA,3,30,4'])assert.throws(()=>parseCSV(csv));
});
test('copies remain distinct and repeat imports match each copy',()=>{
 const imported=parseCSV('Name,Rank,Level\nIncubus,2,16\nIncubus,2,16\nIncubus,2,1');
 const first=planImport(imported,[],{sourceFile:'roster.csv'});
 const stored=first.map((row,i)=>({...row.changes,id:String(i),notes:'My notes'}));
 assert.equal(new Set(stored.map(r=>r.import_key)).size,3);
 assert(planImport(imported,stored,{sourceFile:'roster.csv'}).every(row=>row.action==='Unchanged'));
 assert.equal(stored[1].notes,'My notes');
});
test('starter aliases match full names while progress and notes stay protected',()=>{
 const imported=parseCSV('Name,Rank,Level,Ascension\nDorothy Gale,5,50,3\nVallaryn the Equalizer,5,50,4');
 const existing=[{id:'a',name:'Dorothy',rank:6,level:60,ascension:6,notes:'Keep this build'},{id:'b',name:'Vallyarn',rank:5,level:50,ascension:0}];
 const safe=planImport(imported,existing,{sourceFile:'old.csv'});
 assert.equal(safe[0].existingId,'a');assert.equal(safe[1].existingId,'b');
 assert.equal(safe[0].changes.rank,undefined);assert.equal(safe[0].changes.notes,undefined);
 const overwrite=planImport(imported,existing,{sourceFile:'old.csv',updateProgress:true});
 assert.equal(overwrite[0].changes.rank,5);assert.equal(overwrite[0].changes.ascension,3);assert.equal(overwrite[0].changes.notes,undefined);
});
test('database JSON key ordering does not cause a false update',()=>{
 const imported=parseCSV('Name,Rank,Level,Total HP\nKael,6,60,26883');
 const [first]=planImport(imported,[],{sourceFile:'roster.csv'});
 const stored={...first.changes,id:'a',import_data:{values:{'Total HP':'26883',Level:'60',Rank:'6',Name:'Kael'},sourceFile:'roster.csv'}};
 assert.equal(planImport(imported,[stored],{sourceFile:'roster.csv'})[0].action,'Unchanged');
});
