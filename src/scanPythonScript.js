const { spawn } = require('child_process');
const path = require('path');
const { app } = require('electron');

// Function to scan a Python script for potentially unsafe code
function scanPythonScript(scriptPath) {
  return new Promise((resolve, reject) => {
    // Correctly locate detection script using app.getAppPath() to handle packaged scenarios
    const detectionScriptPath = path.join(app.getAppPath(), '..', 'python_scripts', 'detection_script.py');

    // Spawn a Python process to execute the detection script
    const pythonProcess = spawn('python', [detectionScriptPath, scriptPath]);

    // Buffer to collect the output from the detection script
    let output = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Handle completion of the detection script
    pythonProcess.on('close', (code) => {
      // If the detection script outputs any warnings, consider it unsafe
      if (output.includes('Warning:')) {
        reject(`Detected potential issues:\n${output}`);
      } else {
        resolve(true);
      }
    });

    // Handle errors from the detection script
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Detection Script Error: ${data}`);
    });

    // Handle errors when trying to spawn the process
    pythonProcess.on('error', (error) => {
      reject(`Failed to start detection process: ${error.message}`);
    });
  });
}

module.exports = scanPythonScript;
