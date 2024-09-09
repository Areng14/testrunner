const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('src/ui/index.html');

  // Create a custom menu with File options
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Save Tests',
          click: async () => {
            win.webContents.send('save-tests');
          },
        },
        {
          label: 'Load Tests',
          click: async () => {
            win.webContents.send('load-tests');
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

// Function to run tests and display their details
function runTests(jsonData) {
  const { testfunc, tests, scriptPaths } = jsonData;

  Object.entries(scriptPaths).forEach(([displayName, realPath]) => {
    console.log(`Testing function: ${testfunc}`);
    console.log(`File path: ${realPath}`);

    Object.entries(tests).forEach(([paramStr, [expectedOutput, expectedType]]) => {
      const params = JSON.parse(paramStr); // Convert parameter string back to array

      console.log('Parameters and their types:');
      params.forEach(([paramValue, paramType], index) => {
        console.log(`  Parameter ${index + 1}:`);
        console.log(`    Value: ${paramValue}`);
        console.log(`    Type: ${paramType}`);
      });

      console.log('Expected output:');
      console.log(`  Value: ${expectedOutput}`);
      console.log(`  Type: ${expectedType}`);
      console.log('-----------------------------');
    });
  });
}

// IPC listener to run tests when the 'run-tests' event is received
ipcMain.on('run-tests', (event, jsonData) => {
  runTests(jsonData);
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

app.whenReady().then(createWindow);

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
