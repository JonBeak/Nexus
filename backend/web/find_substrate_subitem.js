// Find orders where Substrate Cut is a sub-item
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/jon/Nexus/backend/web/.env' });

async function findOrders() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n=== ORDERS WHERE SUBSTRATE CUT IS A SUB-ITEM ===\n');

  const [parts] = await connection.execute(
    `SELECT
      op.order_id,
      o.order_number,
      op.part_id,
      op.part_number,
      op.is_parent,
      op.specs_display_name
     FROM order_parts op
     JOIN orders o ON op.order_id = o.order_id
     WHERE op.specs_display_name = 'Substrate Cut'
       AND op.is_parent = 0
     ORDER BY op.order_id DESC
     LIMIT 5`
  );

  if (parts.length === 0) {
    console.log('❌ No orders found where Substrate Cut is a sub-item\n');
    console.log('All Substrate Cut items are currently parent items.');
  } else {
    console.log(`Found ${parts.length} Substrate Cut sub-items:\n`);

    for (const part of parts) {
      console.log(`Order ${part.order_id} (${part.order_number})`);
      console.log(`  Part ${part.part_number} (ID: ${part.part_id})`);
      console.log(`  Is Parent: ${part.is_parent}\n`);
    }

    // Check first one in detail
    const firstPart = parts[0];
    console.log(`\n=== DETAILED CHECK: Order ${firstPart.order_id}, Part ${firstPart.part_id} ===\n`);

    // Get all parts in this order
    const [allParts] = await connection.execute(
      `SELECT part_id, part_number, is_parent, specs_display_name, specifications
       FROM order_parts
       WHERE order_id = ?
       ORDER BY part_number`,
      [firstPart.order_id]
    );

    console.log('All parts in order:');
    allParts.forEach(p => {
      console.log(`  Part ${p.part_number} (ID: ${p.part_id}) - ${p.specs_display_name} - ${p.is_parent ? 'PARENT' : 'SUB-ITEM'}`);
    });

    // Check tasks for this order
    const [tasks] = await connection.execute(
      `SELECT part_id, task_name, notes
       FROM order_tasks
       WHERE order_id = ?
       ORDER BY part_id, sort_order`,
      [firstPart.order_id]
    );

    console.log(`\n\nTasks generated for order (${tasks.length} total):`);

    const tasksByPart = {};
    tasks.forEach(task => {
      if (!tasksByPart[task.part_id]) {
        tasksByPart[task.part_id] = [];
      }
      tasksByPart[task.part_id].push(task);
    });

    for (const [partId, partTasks] of Object.entries(tasksByPart)) {
      const partInfo = allParts.find(p => p.part_id == partId);
      console.log(`\nPart ${partInfo.part_number} (${partInfo.specs_display_name}) - ${partInfo.is_parent ? 'PARENT' : 'SUB-ITEM'}:`);
      partTasks.forEach(task => {
        console.log(`  - ${task.task_name}${task.notes ? ' (' + task.notes + ')' : ''}`);
      });
    }

    // Check if Substrate Cut sub-item has cutting task
    const substrateCutTasks = tasks.filter(t => t.part_id == firstPart.part_id);
    const hasCuttingTask = substrateCutTasks.some(t => t.task_name.includes('Cut') || t.task_name.includes('Router'));

    console.log(`\n\n=== RESULT ===`);
    console.log(`Substrate Cut sub-item (Part ${firstPart.part_id}): ${hasCuttingTask ? '✅ HAS cutting task' : '❌ NO cutting task'}`);
  }

  await connection.end();
}

findOrders().catch(console.error);
