const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// Function to run the Python CLI testing tool and return results in JSON format
function runPythonTests(jsonPath, scriptPath) {
  return new Promise((resolve, reject) => {
    // Correctly locate test.py using app.getAppPath() to handle packaged scenarios
    const testScriptPath = path.join(app.getAppPath(), '..', 'python_scripts', 'test.py');

    // Spawn a Python process to execute the testing script
    const pythonProcess = spawn('python', [testScriptPath, jsonPath, scriptPath]);

    // Buffer to collect the output from the Python script
    let output = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Handle Python script completion
    pythonProcess.on('close', (code) => {
      try {
        // Sanitize the output to properly handle Python lists, dicts, and other structures
        const sanitizedOutput = output
          .replace(/'/g, '"')                    // Replace single quotes with double quotes for JSON compatibility
          .replace(/None/g, 'null')              // Replace Python None with JSON null
          .replace(/True/g, 'true')              // Replace Python True with JSON true
          .replace(/False/g, 'false')            // Replace Python False with JSON false
          .replace(/\((.*?)\)/g, '[$1]')         // Replace Python tuples with JSON arrays
          .replace(/\{(.*?)\}/g, (match) => {    // Handle dictionaries, preserving keys and values
            return match.replace(/"(.*?)":/g, '"$1":'); // Ensure keys are properly formatted with double quotes
          })
          .replace(/,(\s*[\}\]])/g, '$1');       // Remove trailing commas that can cause JSON parsing errors

        const results = JSON.parse(sanitizedOutput);
        if (results.error) {
          reject(`Error: ${results.error}`);
          return;
        }

        // Initialize an object to store the test results
        const testResults = {
          results: [],
          summary: {
            total: results.length,
            passed: 0,
            failed: 0,
          },
        };

        // Process each test result
        results.forEach((result) => {
          const testResult = {
            test: result.test,
            passed: result.passed,
            received: JSON.stringify(result.received), // Ensure the received value is parsed correctly
            error: result.passed ? null : result.error,
          };

          // Update summary counts
          if (result.passed) {
            testResults.summary.passed += 1;
          } else {
            testResults.summary.failed += 1;
          }

          // Add individual test result to the results array
          testResults.results.push(testResult);
        });

        // Resolve the promise with the structured test results
        resolve(testResults);
      } catch (err) {
        reject(`Failed to parse Python output: ${err.message}`);
      }
    });

    // Handle errors from the Python script
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python Error: ${data}`);
    });

    // Handle errors when trying to spawn the process
    pythonProcess.on('error', (error) => {
      reject(`Failed to start Python process: ${error.message}`);
    });
  });
}

module.exports = runPythonTests;
