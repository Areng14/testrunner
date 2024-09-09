const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const runPythonTests = require('./tester')

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

  //write temp json
  const tempDir = os.tmpdir();
  const fileName = `temp_testjson_${Date.now()}.json`;
  const filePath = path.join(tempDir, fileName);

  const alltests = {}
  // Write the JSON data to the file
  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));

  Object.entries(scriptPaths).forEach(([displayName, realPath]) => {
    
    alltests[displayName] = runPythonTests(filePath, realPath);
  });

  fs.unlinkSync(filePath);
  console.log(alltests)
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
