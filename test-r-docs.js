#!/usr/bin/env node
import { RDocsHandler } from './build/r-docs-integration.js';
import { logger } from './build/logger.js';
import { PackageDocsServer } from './build/package-docs-server.js';

/**
 * This test exercises the R documentation functionality directly 
 * without going through the full MCP protocol
 */
async function testRDocsIntegration() {
  console.log('Testing R Documentation Integration');

  try {
    // Test the direct RDocsHandler
    console.log('\n--- Testing RDocsHandler directly ---');
    const rDocsHandler = new RDocsHandler();

    // Test 1: Check if R is installed
    const isRInstalled = await rDocsHandler.isRInstalled();
    console.log(`R is installed: ${isRInstalled}`);
    
    if (!isRInstalled) {
      console.log('R is not installed. Please install R and make sure it is in your PATH.');
      return;
    }

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

    // Test 4: Access through PackageDocsServer (direct method calls, not through protocol)
    console.log('\n--- Testing PackageDocsServer integration ---');
    const packageDocsServer = new PackageDocsServer();
    
    // Mock the request format used internally by the server
    const mockRequest = {
      params: {
        name: "describe_r_package",
        arguments: {
          package: "base",
          symbol: "mean"
        }
      }
    };
    
    // Use reflection to call the private handler function
    console.log('\nTesting server handler for mean function:');
    
    // Create a wrapper function to access private methods
    const callPrivateMethod = async (obj, methodName, ...args) => {
      // Try to access the method by dynamically checking for any method that contains the name
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(obj));
      const matchingMethod = methods.find(m => m.includes(methodName));
      
      if (matchingMethod) {
        return await obj[matchingMethod](...args);
      } else {
        console.log(`Method containing '${methodName}' not found. Available methods:`, methods);
        throw new Error(`Method containing '${methodName}' not found`);
      }
    };
    
    try {
      // Test server's search functionality for R with a smaller package
      console.log('\nTesting search functionality for R with a smaller package:');
      const smallSearchResult = await callPrivateMethod(packageDocsServer, 'searchPackageDocs', {
        package: 'stats', // Use stats package - smaller package
        query: 'median',  // Search for a specific term that should have fewer matches
        language: 'r',
        fuzzy: true
      });
      
      console.log('Search results for stats package:');
      console.log(JSON.stringify(smallSearchResult, null, 2));
      
      // Test with a larger package (base)
      console.log('\nTesting search functionality for R with a larger package (base):');
      const largeSearchResult = await callPrivateMethod(packageDocsServer, 'searchPackageDocs', {
        package: 'base',  // Use base package - larger package with many functions
        query: 'mean',    // Search for a common term
        language: 'r',
        fuzzy: true
      });
      
      console.log('Search results for base package:');
      console.log(JSON.stringify(largeSearchResult, null, 2));
    } catch (error) {
      console.log('Error testing search functionality:', error.message);
      console.log('Falling back to direct handler tests only');
    }
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

testRDocsIntegration().catch(error => {
  console.error('Unhandled error:', error);
});