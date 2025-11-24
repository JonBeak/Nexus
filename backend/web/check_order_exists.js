// Check if order exists
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/jon/Nexus/backend/web/.env' });

async function checkOrder() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n=== CHECKING ORDER 200085 ===\n');

  const [orders] = await connection.execute(
    `SELECT order_id, order_number, status, customer_id, created_at
     FROM orders
     WHERE order_id = 200085`
  );

  if (orders.length === 0) {
    console.log('❌ Order 200085 does NOT exist in the database');

    console.log('\nLet me find recent orders with Substrate Cut items...\n');
    const [recentOrders] = await connection.execute(
      `SELECT DISTINCT o.order_id, o.order_number, o.status
       FROM orders o
       JOIN order_parts p ON o.order_id = p.order_id
       WHERE p.specs_display_name = 'Substrate Cut'
       ORDER BY o.order_id DESC
       LIMIT 10`
    );

    console.log('Recent orders with Substrate Cut items:');
    recentOrders.forEach(order => {
      console.log(`  Order ${order.order_id} (${order.order_number}) - Status: ${order.status}`);
    });
  } else {
    console.log('✅ Order exists:', orders[0]);

    const [partCount] = await connection.execute(
      `SELECT COUNT(*) as count FROM order_parts WHERE order_id = 200085`
    );

    console.log(`\nParts in order: ${partCount[0].count}`);
  }

  await connection.end();
}

checkOrder().catch(console.error);
