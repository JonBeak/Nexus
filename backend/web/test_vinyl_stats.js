const mysql = require('mysql2/promise');

async function testQuery() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'webuser',
    password: 'webpass123',
    database: 'sign_manufacturing'
  });

  const sql = `
    SELECT
      COUNT(*) as total_items,
      SUM(CASE WHEN disposition = 'in_stock' THEN 1 ELSE 0 END) as in_stock_count,
      SUM(CASE WHEN disposition = 'used' THEN 1 ELSE 0 END) as used_count,
      SUM(CASE WHEN disposition = 'waste' THEN 1 ELSE 0 END) as waste_count,
      SUM(CASE WHEN disposition = 'returned' THEN 1 ELSE 0 END) as returned_count,
      SUM(length_yards) as total_yards_all,
      SUM(CASE WHEN disposition = 'in_stock' THEN length_yards ELSE 0 END) as total_yards_in_stock,
      SUM(CASE WHEN disposition = 'used' THEN length_yards ELSE 0 END) as total_yards_used,
      SUM(CASE WHEN disposition = 'waste' THEN length_yards ELSE 0 END) as total_yards_waste,
      COUNT(DISTINCT brand) as brands_count,
      COUNT(DISTINCT CONCAT(brand, '-', series)) as series_count,
      COUNT(DISTINCT location) as locations_count
    FROM vinyl_inventory
  `;

  const [rows] = await connection.execute(sql);
  console.log('Raw result from database:');
  console.log(JSON.stringify(rows[0], null, 2));

  // Check data types
  console.log('\nData types:');
  for (const [key, value] of Object.entries(rows[0])) {
    console.log(`${key}: ${typeof value} = ${value}`);
  }

  await connection.end();
}

testQuery().catch(console.error);