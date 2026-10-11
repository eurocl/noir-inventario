import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseConfig } from '../src/database-config.js';
import { listenOptions } from '../src/deployment.js';
test('no reutiliza la conexión general ni bases ajenas', () => {
  assert.throws(() => databaseConfig({ MONGO_URI:'mongodb://localhost/legacy' }), /DATABASE_URL/);
  assert.throws(() => databaseConfig({ DATABASE_URL:'mongodb://localhost', DATABASE_NAME:'otra_base' }), /DATABASE_NAME/);
  assert.throws(() => databaseConfig({ DATABASE_URL:'https://localhost', DATABASE_NAME:'noir_inventario' }), /MongoDB/);
  assert.deepEqual(databaseConfig({ DATABASE_URL:'mongodb://localhost', DATABASE_NAME:'noir_inventario' }), { uri:'mongodb://localhost', dbName:'noir_inventario' });
});
test('usa su propio puerto y puede escuchar en una PC distinta', () => {
  assert.deepEqual(listenOptions(3003, {PORT:'4010',HOST:'0.0.0.0'}), {port:4010,host:'0.0.0.0'});
});
