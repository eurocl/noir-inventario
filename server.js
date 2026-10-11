import { loadEnvironment, startApi } from './src/runtime.js';
import { createStockApp } from './src/app.js';
import { databaseConfig } from './src/database-config.js';
loadEnvironment();
try {
  await startApi(createStockApp(), { name: 'noir-inventario', port: 3003, requireJwt: false, requireInternalSecret: true, dependencies: [], ...databaseConfig() });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
