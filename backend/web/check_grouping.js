// Check how parts are being grouped
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/jon/Nexus/backend/web/.env' });

async function checkGrouping() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n=== ORDER 206016 - CURRENT PART STRUCTURE ===\n');

  const [parts] = await connection.execute(
    `SELECT part_id, part_number, is_parent, display_number, specs_display_name
     FROM order_parts
     WHERE order_id = 206016
     ORDER BY part_number`
  );

  console.log('Parts in order:');
  parts.forEach(part => {
    console.log(`  Part ${part.part_number} (ID: ${part.part_id})`);
    console.log(`    Display: ${part.display_number}`);
    console.log(`    Type: ${part.specs_display_name}`);
    console.log(`    is_parent: ${part.is_parent} ${part.is_parent ? '← STARTS NEW GROUP' : '← SUB-ITEM'}`);
    console.log('');
  });

  console.log('\n=== EXPECTED GROUPING ===\n');

  let currentGroup = 0;
  parts.forEach(part => {
    if (part.is_parent) {
      currentGroup++;
      console.log(`Group ${currentGroup} (Parent: Part ${part.part_number}, ID: ${part.part_id}):`);
      console.log(`  - Part ${part.part_number} (${part.specs_display_name}) [PARENT]`);
    } else {
      console.log(`  - Part ${part.part_number} (${part.specs_display_name}) [SUB-ITEM]`);
    }
  });

  console.log('\n\n=== TASKS ASSIGNED TO EACH PART ===\n');

  const [tasks] = await connection.execute(
    `SELECT part_id, COUNT(*) as task_count
     FROM order_tasks
     WHERE order_id = 206016
     GROUP BY part_id
     ORDER BY part_id`
  );

  tasks.forEach(t => {
    const part = parts.find(p => p.part_id === t.part_id);
    console.log(`Part ${part.part_number} (ID: ${t.part_id}) - ${part.specs_display_name}`);
    console.log(`  is_parent: ${part.is_parent}`);
    console.log(`  Task count: ${t.task_count}`);
    console.log(`  ${part.is_parent ? '✅ Correct - parent has tasks' : '❌ WRONG - sub-item should NOT have tasks'}`);
    console.log('');
  });

  await connection.end();
}

checkGrouping().catch(console.error);
