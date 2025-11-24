// Find orders with Substrate Cut items
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/jon/Nexus/backend/web/.env' });

async function findOrders() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n=== ORDERS WITH SUBSTRATE CUT ITEMS ===\n');

  const [orders] = await connection.execute(
    `SELECT
      o.order_id,
      o.order_number,
      o.status,
      COUNT(p.part_id) as part_count,
      SUM(CASE WHEN p.specs_display_name = 'Substrate Cut' THEN 1 ELSE 0 END) as substrate_count
     FROM orders o
     JOIN order_parts p ON o.order_id = p.order_id
     GROUP BY o.order_id
     HAVING substrate_count > 0
     ORDER BY o.order_id DESC
     LIMIT 10`
  );

  console.log('Recent orders with Substrate Cut parts:\n');
  orders.forEach(order => {
    console.log(`Order ${order.order_id} (${order.order_number})`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Total Parts: ${order.part_count}`);
    console.log(`  Substrate Cut Parts: ${order.substrate_count}`);
    console.log('');
  });

  if (orders.length > 0) {
    const firstOrder = orders[0];
    console.log(`\n=== CHECKING ORDER ${firstOrder.order_id} IN DETAIL ===\n`);

    const [parts] = await connection.execute(
      `SELECT
        part_id,
        part_number,
        is_parent,
        specs_display_name,
        specifications
       FROM order_parts
       WHERE order_id = ?
       ORDER BY part_number`,
      [firstOrder.order_id]
    );

    parts.forEach(part => {
      console.log(`Part ${part.part_number} (ID: ${part.part_id})`);
      console.log(`  Type: ${part.specs_display_name}`);
      console.log(`  Is Parent: ${part.is_parent}`);

      if (part.specs_display_name === 'Substrate Cut') {
        console.log(`  Specs:`, part.specifications);

        // Check for Cutting spec
        const hasCutting = Object.keys(part.specifications || {}).some(key =>
          key.includes('_template_') && part.specifications[key] === 'Cutting'
        );
        console.log(`  Has Cutting Spec: ${hasCutting ? '✅' : '❌'}`);
      }
      console.log('');
    });
  }

  await connection.end();
}

findOrders().catch(console.error);
