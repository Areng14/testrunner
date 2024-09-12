const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const runPythonTests = require('./tester');

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'Testrunner UI'
  });


  win.loadFile('src/ui/index.html');

  Menu.setApplicationMenu(null);
}

// Function to check if Python is installed
function checkPythonInstallation() {
  return new Promise((resolve, reject) => {
    exec('python --version', (error, stdout, stderr) => {
      if (error || stderr) {
        dialog.showErrorBox(
          'Python Not Found',
          'Python is not installed on this system. Please install Python to use this application.'
        );
        app.quit(); // Quit the app if Python is not installed
        reject(false);
      } else {
        console.log(`Python version detected: ${stdout.trim()}`);
        resolve(true);
      }
    });
  });
}

// Function to run tests and display their details
async function runTests(jsonData) {
  const { testfunc, tests, scriptPaths } = jsonData;

  // Create a temporary file for the JSON data
  const tempDir = os.tmpdir();
  const fileName = `temp_testjson_${Date.now()}.json`;
  const filePath = path.join(tempDir, fileName);

  // Write the JSON data to the file
  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));

  // Object to store all test results
  const alltests = {};

  // Iterate over each script path and run the Python tests
  for (const [displayName, realPath] of Object.entries(scriptPaths)) {
    try {
      // Await the result of runPythonTests
      const testResult = await runPythonTests(filePath, realPath);
      alltests[displayName] = testResult;
    } catch (error) {
      console.error(`Failed to run tests for ${displayName}: ${error}`);
      alltests[displayName] = { error: error.message };
    }
  }

  // Clean up the temporary JSON file
  fs.unlinkSync(filePath);

  // Log the collected test results
  console.log('Results:', JSON.stringify(alltests, null, 2));

  // Return the results if needed elsewhere
  return alltests;
}

ipcMain.on('show-error-alert', (event, message) => {
  dialog.showErrorBox('Error', message);
});

// Handle request from renderer to run tests
ipcMain.on('run-tests', async (event, jsonData) => {
  try {
    // Run the tests and collect results
    const results = await runTests(jsonData);

    // Send the results back to the renderer process
    event.reply('test-results', results); // Sends the results back to the renderer
  } catch (error) {
    console.error('Error running tests:', error);
    event.reply('test-results', { error: 'Failed to run tests' });
  }
});

ipcMain.on('edit-file', (event, filePath) => {
  const platform = process.platform;

  let command;
  if (platform === 'win32') {
    command = `notepad "${filePath}"`;
  } else if (platform === 'darwin') {
    command = `open "${filePath}"`;
  } else if (platform === 'linux') {
    command = `xdg-open "${filePath}"`;
  } else {
    console.error('Unsupported platform');
    return;
  }

  exec(command, (err) => {
    if (err) {
      console.error(`Error opening file: ${err}`);
    }
  });
});

ipcMain.handle('select-script', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select a File or Folder',
    properties: ['openFile', 'openDirectory'],
    filters: [{ name: 'Python Files', extensions: ['py'] }],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const selectedPath = filePaths[0];
  const stat = fs.statSync(selectedPath);

  if (stat.isDirectory()) {
    const pyFiles = fs
      .readdirSync(selectedPath)
      .filter((file) => file.endsWith('.py'))
      .map((file) => path.join(selectedPath, file));
    return pyFiles;
  } else {
    return [selectedPath];
  }
});

ipcMain.handle('save-json-data', async (event, jsonData) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save JSON Data',
      defaultPath: 'data.json',
      buttonLabel: 'Save',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
      return 'Data saved successfully!';
    }

    return 'Save canceled or failed.';
  } catch (error) {
    console.error('Error saving JSON:', error);
    return 'Error saving data.';
  }
});

ipcMain.handle('load-json-data', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Load JSON Data',
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (!canceled && filePaths.length > 0) {
      const data = fs.readFileSync(filePaths[0], 'utf-8');
      return JSON.parse(data);
    }

    return null;
  } catch (error) {
    console.error('Error loading JSON:', error);
    throw new Error('Error loading data.');
  }
});

app.whenReady().then(async () => {
  try {
    const pythonInstalled = await checkPythonInstallation();
    if (pythonInstalled) {
      createWindow();
    }
  } catch (error) {
    console.error('Python check failed:', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
