// Direct test for R documentation
import { RDocsHandler } from './build/r-docs-integration.js';

async function testRDocs() {
  console.log('Testing R Documentation Handler');
  
  try {
    const rDocsHandler = new RDocsHandler();

    // Test if R is installed
    const isRInstalled = await rDocsHandler.isRInstalled();
    console.log(`R is installed: ${isRInstalled}`);
    
    if (!isRInstalled) {
      console.log('R is not installed. Please install R and make sure it is in your PATH.');
      return;
    }

    // Test 1: Check if base package is installed
    console.log('\nTest 1: Check if base package is installed:');
    const isBaseInstalled = await rDocsHandler.isRPackageInstalled('base');
    console.log(`Base package installed: ${isBaseInstalled}`);
    
    // Test 2: Get basic package documentation for base
    console.log('\nTest 2: Get basic package documentation for base:');
    const baseDocResult = await rDocsHandler.describeRPackage({
      package: 'base'
    });
    console.log('Base package documentation:');
    console.log(JSON.stringify(baseDocResult, null, 2));
    
    // Test 3: Get documentation for a specific function (mean)
    console.log('\nTest 3: Get documentation for mean function:');
    const meanDocResult = await rDocsHandler.describeRPackage({
      package: 'base',
      symbol: 'mean'
    });
    console.log('Mean function documentation:');
    console.log(JSON.stringify(meanDocResult, null, 2));
    
    // Test 4: Get full package documentation
    console.log('\nTest 4: Get full package documentation for base:');
    const fullBaseDocResult = await rDocsHandler.getRPackageDoc({
      package: 'base'
    });
    console.log('Full base package documentation (truncated):');
    if (fullBaseDocResult.description) {
      console.log('Description:');
      console.log(fullBaseDocResult.description.slice(0, 200) + '...');
    }
    if (fullBaseDocResult.usage) {
      console.log('Usage (first 200 chars):');
      console.log(fullBaseDocResult.usage.slice(0, 200) + '...');
    }
    
    // Test 5: Get full documentation for a specific function with examples
    console.log('\nTest 5: Get full documentation for mean function with examples:');
    const fullMeanDocResult = await rDocsHandler.getRPackageDoc({
      package: 'base',
      symbol: 'mean'
    });
    console.log('Full mean function documentation:');
    console.log(JSON.stringify(fullMeanDocResult, null, 2));
    
    // Test 6: Try with a non-existent package
    console.log('\nTest 6: Try with a non-existent package:');
    const nonExistentResult = await rDocsHandler.describeRPackage({
      package: 'nonexistentpackage123'
    });
    console.log('Non-existent package result:');
    console.log(JSON.stringify(nonExistentResult, null, 2));
    
    // Test 7: Try with a real but possibly not installed package
    console.log('\nTest 7: Try with dplyr package (may not be installed):');
    const dplyrResult = await rDocsHandler.describeRPackage({
      package: 'dplyr'
    });
    console.log('dplyr package result:');
    console.log(JSON.stringify(dplyrResult, null, 2));
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testRDocs().catch(error => {
  console.error('Unhandled error:', error);
});