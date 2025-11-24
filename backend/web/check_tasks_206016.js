// Check tasks for order 206016
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/jon/Nexus/backend/web/.env' });

async function checkTasks() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n=== TASKS FOR ORDER 206016 (Order #200085) ===\n');

  const [tasks] = await connection.execute(
    `SELECT
      task_id,
      part_id,
      task_name,
      sort_order,
      assigned_role,
      notes
     FROM order_tasks
     WHERE order_id = 206016
     ORDER BY part_id, sort_order`
  );

  if (tasks.length === 0) {
    console.log('❌ NO TASKS GENERATED for this order!\n');
    console.log('This could mean:');
    console.log('  1. Tasks were never generated');
    console.log('  2. The order is in a status that doesn\'t have tasks yet');
    console.log('  3. Tasks were deleted\n');

    const [order] = await connection.execute(
      `SELECT tasks_generated_at, tasks_data_hash FROM orders WHERE order_id = 206016`
    );

    console.log('Order task metadata:', order[0]);
  } else {
    console.log(`✅ Found ${tasks.length} tasks\n`);

    const tasksByPart = {};
    tasks.forEach(task => {
      if (!tasksByPart[task.part_id]) {
        tasksByPart[task.part_id] = [];
      }
      tasksByPart[task.part_id].push(task);
    });

    for (const [partId, partTasks] of Object.entries(tasksByPart)) {
      console.log(`\n--- Part ID ${partId} ---`);

      // Get part info
      const [partInfo] = await connection.execute(
        `SELECT part_number, specs_display_name FROM order_parts WHERE part_id = ?`,
        [partId]
      );

      console.log(`Part ${partInfo[0].part_number} (${partInfo[0].specs_display_name})\n`);

      partTasks.forEach(task => {
        console.log(`  ${task.sort_order}. ${task.task_name}`);
        console.log(`     Role: ${task.assigned_role}`);
        if (task.notes) console.log(`     Notes: ${task.notes}`);
      });
    }

    // Check specifically for cutting tasks
    const cuttingTasks = tasks.filter(t =>
      t.task_name.includes('Cut') || t.task_name.includes('Router') || t.task_name.includes('Laser')
    );

    console.log(`\n\n=== CUTTING TASKS ANALYSIS ===`);
    console.log(`Found ${cuttingTasks.length} cutting-related tasks:\n`);

    if (cuttingTasks.length > 0) {
      cuttingTasks.forEach(task => {
        console.log(`  ✅ ${task.task_name} (Part ${task.part_id})`);
        if (task.notes) console.log(`     Notes: ${task.notes}`);
      });
    } else {
      console.log('  ❌ No CNC Router Cut or Laser Cut tasks found!');
      console.log('  ❌ This is the bug we need to fix.');
    }
  }

  await connection.end();
}

checkTasks().catch(console.error);
