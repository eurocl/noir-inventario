# noir-inventario

Backend independiente de Proyecto Noir. Contiene únicamente la responsabilidad de stock. No importa código de carpetas vecinas y tiene sus propias dependencias.

## Infraestructura

Repositorio exclusivo: https://github.com/eurocl/noir-inventario. Servicio de Render: noir-inventario. URL de API: https://noir-stock.onrender.com. Clúster propio de MongoDB Atlas, base noir_inventario y colección inventory. La conexión privada se configura con DATABASE_URL.

## API

- GET /health: estado de la conexión a MongoDB.
- GET /stock: existencias con productId y stock.
- GET /stock/:id: existencias de un producto, o 404 si no existe el registro.
- PUT /internal/stock/:id: inicializa existencias con body {stock}, sin sobrescribir cantidades existentes.
- DELETE /internal/stock/:id: elimina el registro de inventario.

Las escrituras internas requieren X-Service-Key, con el secreto compartido únicamente con Productos. npm test verifica permisos, consultas, validaciones e inicialización idempotente mediante repositorios simulados, sin modificar MongoDB.

## Arranque

1. Instalar Node.js 24.
2. Ejecutar npm ci.
3. Copiar .env.example a .env y completar DATABASE_URL con la conexión del clúster de este backend.
4. Mantener DATABASE_NAME=noir_inventario y completar los secretos necesarios.
5. Ejecutar npm start. La API comienza a escuchar después de conectarse a su base.
6. Consultar http://localhost:3003/health.

No hay fallback a MONGO_URI ni a la base de otro backend. Al arrancar, Mongoose conecta a Atlas. Si Atlas no está disponible, el proceso termina con error y debe reiniciarse una vez corregida la conexión. Una cuenta Atlas y un usuario de base de datos son cosas distintas: la aplicación usa el usuario de base de datos.

## Otra computadora o Render

En otra PC, usar HOST=0.0.0.0 y permitir el puerto en la red privada del equipo. Los clientes deben apuntar a la IP o nombre de esa PC, no a localhost. Mantener los secretos fuera de Git. En Render, Build Command npm ci, Start Command npm start y Health Check Path /health. Render asigna PORT. 

INTERNAL_SERVICE_SECRET debe coincidir entre Productos e Inventario para autorizar sus llamadas internas.

## Datos

Usar una cuenta Atlas dedicada a este backend, con su propio proyecto, clúster y usuario de base de datos limitado a readWrite en noir_inventario. No copiar aquí credenciales del clúster anterior. No migrar ni borrar datos desde el comando de arranque.
