const { ipcRenderer } = require('electron');
const path = require('path');

// Define the types array globally so it's accessible everywhere
const types = ['any', 'int', 'float', 'str', 'list', 'dict', 'bool'];

// Dictionary to store the real paths of scripts
const scriptPaths = {};

document.addEventListener('DOMContentLoaded', () => {
  // Grabbing the necessary DOM elements
  const tabs = document.querySelectorAll('.tab');
  const testContent = document.getElementById('test-content');
  const editorContent = document.getElementById('editor-content');
  const addTestBtn = document.getElementById('add-test-btn');
  const exportTestBtn = document.getElementById('export-test-btn');
  const loadTestBtn = document.getElementById('load-test-btn');
  const runTestBtn = document.getElementById('run-test-btn');
  const testList = document.getElementById('test-list-ul');
  const functionInput = document.getElementById('function-input');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const addScriptBtn = document.getElementById('add-script-btn');
  const scriptsList = document.getElementById('scripts-list-ul');

  // Ensure the button is defined and not duplicated
  if (!themeToggleBtn) {
    console.error('Dark mode button not found');
    return;
  }

  // Load theme preference from localStorage
  const currentTheme = localStorage.getItem('theme') || 'light';
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggleBtn.textContent = '☀️'; // Sun icon for light mode
  } else {
    themeToggleBtn.textContent = '🌙'; // Moon icon for dark mode
  }

  // Toggle theme and save preference when button is clicked
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    themeToggleBtn.textContent = isDarkMode ? '☀️' : '🌙'; // Toggle between sun and moon icons
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  });

  // Tab switching logic
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      if (tab.id === 'test-tab') {
        testContent.style.display = 'block';
        editorContent.style.display = 'none';
      } else {
        testContent.style.display = 'none';
        editorContent.style.display = 'block';
      }
    });
  });

  testContent.style.display = 'block';
  tabs[0].classList.add('active');

  // Function to add a parameter row with type selector
  function addParameterRow(paramList, paramValue = '', paramType = 'any') {
    const paramRow = document.createElement('div');
    paramRow.className = 'param-row';

    const paramInput = document.createElement('input');
    paramInput.type = 'text';
    paramInput.placeholder = 'Parameter...';
    paramInput.value = paramValue;

    const paramTypeSelect = document.createElement('select');
    paramTypeSelect.className = 'param-type-select';
    types.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      paramTypeSelect.appendChild(option);
    });
    paramTypeSelect.value = paramType;

    // Function to update placeholder based on selected type with examples
    const updatePlaceholder = () => {
      switch (paramTypeSelect.value) {
        case 'int':
          paramInput.placeholder = 'Enter a number, e.g., 1';
          break;
        case 'float':
          paramInput.placeholder = 'Enter a decimal number, e.g., 3.14';
          break;
        case 'str':
          paramInput.placeholder = 'Enter text, e.g., "hello"';
          break;
        case 'list':
          paramInput.placeholder = 'Enter a list, e.g., [1, 2, 3]';
          break;
        case 'dict':
          paramInput.placeholder = 'Enter a dictionary, e.g., {"key": "value"}';
          break;
        case 'bool':
          paramInput.placeholder = 'Enter true or false';
          break;
        default:
          paramInput.placeholder = 'Parameter...';
          break;
      }
    };

    // Initial call to set the correct placeholder
    updatePlaceholder();

    // Add an event listener to update the placeholder on type change
    paramTypeSelect.addEventListener('change', updatePlaceholder);

    const removeParamBtn = document.createElement('button');
    removeParamBtn.textContent = 'Remove';
    removeParamBtn.className = 'remove-param-btn';
    removeParamBtn.addEventListener('click', () => paramRow.remove());

    paramRow.appendChild(paramInput);
    paramRow.appendChild(paramTypeSelect);
    paramRow.appendChild(removeParamBtn);

    paramList.appendChild(paramRow);
  }

  // Function to add a test case with parameter list and output
  function addTestCase(testParams = [], expectedOutput = '', expectedType = 'any') {
    const li = document.createElement('li');
    li.className = 'test-input-group';

    // Parameter List Container
    const paramList = document.createElement('div');
    paramList.className = 'param-list';

    // Button to add parameters
    const addParamBtn = document.createElement('button');
    addParamBtn.textContent = 'Add Parameter';
    addParamBtn.className = 'add-param-btn';
    addParamBtn.addEventListener('click', () => addParameterRow(paramList));

    // Add initial parameters if any
    testParams.forEach(([paramValue, paramType]) => addParameterRow(paramList, paramValue, paramType));

    // Row for expected output and type dropdown
    const testRow = document.createElement('div');
    testRow.className = 'test-row';

    const expectedOutputInput = document.createElement('input');
    expectedOutputInput.type = 'text';
    expectedOutputInput.placeholder = 'Expected output...';
    expectedOutputInput.value = expectedOutput;

    const outputTypeSelect = document.createElement('select');
    outputTypeSelect.className = 'output-type-select';
    types.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      outputTypeSelect.appendChild(option);
    });
    outputTypeSelect.value = expectedType;

    // Append input and dropdown to the same row
    testRow.appendChild(expectedOutputInput);
    testRow.appendChild(outputTypeSelect);

    const removeTestBtn = document.createElement('button');
    removeTestBtn.textContent = 'Remove';
    removeTestBtn.className = 'remove-btn';
    removeTestBtn.addEventListener('click', () => li.remove());

    // Append everything to the list item
    li.appendChild(paramList);
    li.appendChild(addParamBtn);
    li.appendChild(testRow); // Append the new row with the input and dropdown
    li.appendChild(removeTestBtn);
    testList.appendChild(li);
  }

  addTestCase(); // Add an initial test case

  addTestBtn.addEventListener('click', () => addTestCase());

  // Event listener for the export tests button
  exportTestBtn.addEventListener('click', async () => {
    console.log('Export button clicked'); // Log to confirm event triggered
    await saveTests(); // Call the saveTests function directly
  });

  // Function to collect data and save tests
  async function saveTests() {
    console.log('Initiating save tests...'); // Log to ensure the process starts
    const functionName = functionInput.value || 'function_name';
    const tests = {};

    testList.querySelectorAll('li').forEach((li) => {
      const params = Array.from(li.querySelectorAll('.param-row')).map((row) => {
        const paramValue = row.querySelector('input[type="text"]').value;
        const paramType = row.querySelector('.param-type-select').value;
        return [paramValue, paramType];
      });

      const expectedOutput = li.querySelector('.test-row input[type="text"]').value;
      const expectedType = li.querySelector('.output-type-select').value;

      tests[JSON.stringify(params)] = [expectedOutput, expectedType];
    });

    const jsonData = {
      testfunc: functionName,
      tests: tests,
      scriptPaths: scriptPaths, // Include the script paths in the saved JSON data
    };

    try {
      const result = await ipcRenderer.invoke('save-json-data', jsonData);
      console.log(result); // Log the success message from the main process
    } catch (error) {
      console.error('Error saving data:', error); // Log error if any occurs
    }
  }

  // Load Tests button functionality
  loadTestBtn.addEventListener('click', async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
      });

      const file = await fileHandle.getFile();
      const content = await file.text();
      const data = JSON.parse(content);

      if (data.testfunc && data.tests) {
        functionInput.value = data.testfunc;

        // Clear existing tests
        testList.innerHTML = '';
        Object.assign(scriptPaths, data.scriptPaths || {});

        // Load the test cases from the file
        Object.entries(data.tests).forEach(([paramStr, [output, type]]) => {
          const params = JSON.parse(paramStr);
          addTestCase(params, output, type);
        });

        // Automatically switch to the editor tab after loading
        document.getElementById('editor-tab').click();
        console.log('Tests loaded successfully!');
      } else {
        console.error('Invalid test data format.');
      }
    } catch (error) {
      console.error('Error loading test file:', error);
    }
  });

  // Run Tests button functionality
  runTestBtn.addEventListener('click', () => {
    const functionName = functionInput.value;
    const tests = {};

    testList.querySelectorAll('li').forEach((li) => {
      // Collect parameters from parameter rows
      const params = Array.from(li.querySelectorAll('.param-row')).map((row) => {
        const paramValue = row.querySelector('input[type="text"]').value;
        const paramType = row.querySelector('.param-type-select').value;
        return [paramValue, paramType];
      });

      // Collect expected output and its type specifically from the test row
      const expectedOutput = li.querySelector('.test-row input[type="text"]').value;
      const expectedType = li.querySelector('.test-row .output-type-select').value;

      tests[JSON.stringify(params)] = [expectedOutput, expectedType];
    });

    const jsonData = {
      testfunc: functionName,
      tests: tests,
      scriptPaths: scriptPaths, // Include script paths in the test run data
    };

    // Send the JSON data to the main process to run the tests
    ipcRenderer.send('run-tests', jsonData);
  });

  // Add script button event listener
  addScriptBtn.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('select-script');
    if (result && result.length > 0) {
      result.forEach((filePath) => addScriptItem(filePath));
    }
  });

  // Function to add an item to the scripts list
  function addScriptItem(filePath) {
    // Check if the file path already exists in the scriptPaths
    if (Object.values(scriptPaths).includes(filePath)) {
      alert('This file has already been added.'); // Alert the user that the file is already added
      return; // Exit the function to avoid adding a duplicate
    }

    const li = document.createElement('li');
    li.className = 'script-item';

    // Display only the base name of the file
    const filename = document.createElement('span');
    filename.className = 'script-filename';
    let textContent = path.basename(filePath);
    if (textContent.length > 64) {
      textContent = textContent.slice(0, 64) + '...';
    }
    filename.textContent = textContent;

    // Store the real path in the dictionary
    scriptPaths[textContent] = filePath;

    // Create the edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '📝';
    editBtn.title = 'Edit this file';
    editBtn.addEventListener('click', () => {
      ipcRenderer.send('edit-file', scriptPaths[textContent]);
    });

    // Create the remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'scriptremove-btn';
    removeBtn.addEventListener('click', () => {
      // Remove the entry from the dictionary and the DOM
      delete scriptPaths[textContent];
      li.remove();
      // Remove from JSON data as well if needed
      saveTests();
    });

    // Append the filename, edit button, and remove button
    li.appendChild(filename);
    li.appendChild(editBtn);
    li.appendChild(removeBtn);
    scriptsList.appendChild(li);
  }

  // Listener to handle opening the file in the default text editor
  ipcRenderer.on('edit-file', (event, filePath) => {
    // Logic to open the file using the system's default text editor
    const { shell } = require('electron');
    shell.openPath(filePath).catch((error) => {
      console.error('Failed to open file:', error);
    });
  });
});
