// Quick debug script to check order 200085
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/jon/Nexus/backend/web/.env' });

async function checkOrder() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n=== ORDER 200085 - PARTS ===\n');
  const [parts] = await connection.execute(
    `SELECT
      part_id,
      part_number,
      is_parent,
      display_number,
      specs_display_name,
      specifications
    FROM order_parts
    WHERE order_id = 200085
    ORDER BY part_number`
  );

  parts.forEach(part => {
    console.log(`Part ${part.part_number} (ID: ${part.part_id})`);
    console.log(`  Is Parent: ${part.is_parent}`);
    console.log(`  Display: ${part.display_number}`);
    console.log(`  Type: ${part.specs_display_name}`);
    console.log(`  Specs: ${JSON.stringify(part.specifications, null, 2)}`);
    console.log('');
  });

  console.log('\n=== ORDER 200085 - TASKS ===\n');
  const [tasks] = await connection.execute(
    `SELECT
      task_id,
      part_id,
      task_name,
      sort_order,
      assigned_role,
      notes
    FROM order_tasks
    WHERE order_id = 200085
    ORDER BY part_id, sort_order`
  );

  const tasksByPart = {};
  tasks.forEach(task => {
    if (!tasksByPart[task.part_id]) {
      tasksByPart[task.part_id] = [];
    }
    tasksByPart[task.part_id].push(task);
  });

  for (const [partId, partTasks] of Object.entries(tasksByPart)) {
    console.log(`\nTasks for Part ID ${partId}:`);
    partTasks.forEach(task => {
      console.log(`  - ${task.task_name} (${task.assigned_role})${task.notes ? ' - ' + task.notes : ''}`);
    });
  }

  await connection.end();
}

checkOrder().catch(console.error);
