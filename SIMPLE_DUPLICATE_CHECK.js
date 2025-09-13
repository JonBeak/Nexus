// Simple Duplicate Key Checker - Paste this in browser console

console.log('🔍 Simple Duplicate Check...');

const gridEngine = window.gridEngineTestAccess;
if (!gridEngine) {
  console.log('❌ GridEngine not available');
} else {
  const coreData = gridEngine.getCoreData();
  const calculatedRows = gridEngine.getRows();
  
  // Check core data for duplicates
  const coreIds = coreData.map(row => row.id);
  const coreDuplicates = coreIds.filter((id, index) => coreIds.indexOf(id) !== index);
  
  // Check calculated rows for duplicates  
  const calcIds = calculatedRows.map(row => row.id);
  const calcDuplicates = calcIds.filter((id, index) => calcIds.indexOf(id) !== index);
  
  console.log('Core Data:', coreData.length, 'rows');
  console.log('Calculated Rows:', calculatedRows.length, 'rows');
  
  if (coreDuplicates.length > 0) {
    console.log('❌ Core duplicates:', coreDuplicates);
  } else {
    console.log('✅ No core duplicates');
  }
  
  if (calcDuplicates.length > 0) {
    console.log('❌ Calc duplicates:', calcDuplicates);
  } else {
    console.log('✅ No calc duplicates');
  }
  
  // Show all current IDs
  console.log('All current IDs:');
  coreData.forEach((row, i) => {
    console.log(`${i}: ${row.rowType} - ${row.id.slice(-8)}`);
  });
};