// Debug why Substrate Cut cutting task isn't being generated
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/home/jon/Nexus/backend/web/.env' });

async function debug() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('\n=== DEBUGGING CUTTING TASK GENERATION ===\n');

  // Get all parts in order 206016
  const [parts] = await connection.execute(
    `SELECT part_id, part_number, is_parent, specs_display_name, specifications
     FROM order_parts
     WHERE order_id = 206016
     ORDER BY part_number`
  );

  console.log('=== GROUP 2 (Part 2 + Sub-items) ===\n');

  const group2Parts = parts.filter(p =>
    p.part_id === 899 || // Parent
    p.part_id === 903 || // Backer sub-item
    p.part_id === 904    // Substrate Cut sub-item
  );

  // Simulate the grouping logic
  const allSpecs = [];
  group2Parts.forEach(part => {
    console.log(`Part ${part.part_number} (${part.specs_display_name}) - ${part.is_parent ? 'PARENT' : 'SUB-ITEM'}`);
    console.log(`Specifications:`, JSON.stringify(part.specifications, null, 2));

    // Parse specs
    const specs = part.specifications || {};
    for (let i = 1; i <= 10; i++) {
      const templateName = specs[`_template_${i}`];
      if (!templateName) break;

      const values = {};
      const rowPrefix = `row${i}_`;
      for (const [key, value] of Object.entries(specs)) {
        if (key.startsWith(rowPrefix)) {
          const fieldName = key.substring(rowPrefix.length);
          values[fieldName] = value;
        }
      }

      allSpecs.push({
        templateName,
        values,
        fromPart: part.part_number
      });
    }
    console.log('');
  });

  console.log('\n=== ALL SPECS IN GROUP 2 ===\n');
  allSpecs.forEach((spec, index) => {
    console.log(`${index + 1}. ${spec.templateName} (from Part ${spec.fromPart})`);
    console.log(`   Values:`, spec.values);
  });

  console.log('\n=== CUTTING SPECS ===\n');
  const cuttingSpecs = allSpecs.filter(s => s.templateName === 'Cutting');
  console.log(`Found ${cuttingSpecs.length} Cutting specs:`);
  cuttingSpecs.forEach((spec, index) => {
    console.log(`\n${index + 1}. Cutting spec from Part ${spec.fromPart}`);
    console.log(`   Method: ${spec.values.method}`);
    console.log(`   Should generate: CNC Router Cut task`);
  });

  console.log('\n=== MATERIAL/BOX TYPE SPECS ===\n');
  const materialSpecs = allSpecs.filter(s =>
    s.templateName === 'Material' || s.templateName === 'Box Type'
  );
  console.log(`Found ${materialSpecs.length} Material/Box Type specs:`);
  materialSpecs.forEach((spec, index) => {
    console.log(`\n${index + 1}. ${spec.templateName} spec from Part ${spec.fromPart}`);
    console.log(`   Values:`, spec.values);
  });

  console.log('\n\n=== EXPECTED BEHAVIOR ===\n');
  console.log('With the current implementation:');
  console.log(`- Should generate ${cuttingSpecs.length} CNC Router Cut tasks`);
  console.log(`- But extractBoxTypeMaterial() will return the FIRST material found`);
  console.log(`- So all cutting tasks will have the same material notes`);
  console.log(`\nThis is the bug! We need to match each Cutting spec with its corresponding Material spec.`);

  await connection.end();
}

debug().catch(console.error);
