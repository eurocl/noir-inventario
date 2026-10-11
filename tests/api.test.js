import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createStockApp, Inventory } from '../src/app.js';

test('inventario: consultas, protección de escrituras e inicialización idempotente', async t => {
  process.env.INTERNAL_SERVICE_SECRET='test-only-internal-secret';
  const id='507f1f77bcf86cd799439011';
  const items=new Map();
  t.mock.method(Inventory,'find',()=>({lean:async()=>[...items.values()]}));
  t.mock.method(Inventory,'findById',id=>({lean:async()=>items.get(id)}));
  t.mock.method(Inventory,'findOneAndUpdate',async({_id},update)=>{
    if(!items.has(_id))items.set(_id,{_id,stock:update.$setOnInsert.stock});
    return items.get(_id);
  });
  t.mock.method(Inventory,'deleteOne',async({_id})=>items.delete(_id));
  const server=createStockApp().listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const put=(stock,key)=>fetch(base+'/internal/stock/'+id,{method:'PUT',headers:{'Content-Type':'application/json',...(key?{'X-Service-Key':key}:{})},body:JSON.stringify({stock})});
  assert.equal((await put(4)).status,401);
  assert.equal((await put(4,'wrong')).status,401);
  assert.equal(items.size,0);
  assert.equal((await put(-1,process.env.INTERNAL_SERVICE_SECRET)).status,400);
  assert.equal((await put(4,process.env.INTERNAL_SERVICE_SECRET)).status,200);
  assert.equal((await put(99,process.env.INTERNAL_SERVICE_SECRET)).status,200);
  const result=await fetch(base+'/stock/'+id);
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{productId:id,stock:4});
  assert.equal((await fetch(base+'/stock/invalid')).status,400);
  assert.equal((await fetch(base+'/internal/stock/'+id,{method:'DELETE'})).status,401);
  assert.equal((await fetch(base+'/internal/stock/'+id,{method:'DELETE',headers:{'X-Service-Key':process.env.INTERNAL_SERVICE_SECRET}})).status,200);
  assert.equal((await fetch(base+'/stock/'+id)).status,404);
});
