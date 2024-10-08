const { ipcRenderer } = require('electron');
const path = require('path');

// Define the types array globally so it's accessible everywhere
// List of common Python types
const types = [
  'any',        // Special placeholder type
  'int',        // Integer numbers
  'float',      // Floating-point numbers
  'str',        // String of characters
  'list',       // Ordered mutable collection
  'dict',       // Key-value pairs
  'tuple',      // Ordered immutable collection
  'bool',       // Boolean values: True or False
  'set',        // Unordered collection of unique elements
  'NoneType',   // Represents the None value
  'bytes',      // Byte sequences
  'error',      // Error or exception
];

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
  const removeAllScriptsBtn = document.getElementById('remove-all-scripts');
  const removeAllTestsBtn = document.getElementById('remove-all-tests-btn');

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
      } else if (tab.id === 'editor-tab') {
        testContent.style.display = 'none';
        editorContent.style.display = 'block';
      }
    });
  });

  testContent.style.display = 'block';
  tabs[0].classList.add('active');

  function refreshInputs() {
    setTimeout(() => {
      // Force focus to the window
      window.focus();
      // Optionally, re-focus specific inputs if needed
      document.querySelectorAll('input, textarea, select').forEach((input) => {
        input.focus();
        input.blur(); // Quickly toggle focus to refresh state
      });
    }, 100); // Delay to ensure actions are registered
  }

  // Function to add a parameter row with type selector
  function addParameterRow(paramList, paramValue = '', paramType = 'any') {
    const paramRow = document.createElement('div');
    paramRow.className = 'param-row';

    const paramInput = document.createElement('input');
    paramInput.type = 'text';
    paramInput.placeholder = 'Parameter...';
    paramInput.value = paramValue;

    // Filter 'error' type from the parameters as it is only for expected output
    const paramTypes = types.filter((type) => type !== 'error');
    const paramTypeSelect = document.createElement('select');
    paramTypeSelect.className = 'param-type-select';
    paramTypes.forEach((type) => {
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
          paramInput.disabled = false;
          break;
        case 'float':
          paramInput.placeholder = 'Enter a decimal number, e.g., 3.14';
          paramInput.disabled = false;
          break;
        case 'str':
          paramInput.placeholder = 'Enter text, e.g., hello';
          paramInput.disabled = false;
          break;
        case 'list':
          paramInput.placeholder = 'Enter a list, e.g., [1, 2, 3]';
          paramInput.disabled = false;
          break;
        case 'dict':
          paramInput.placeholder = 'Enter a dictionary, e.g., {"key": "value"}';
          paramInput.disabled = false;
          break;
        case 'tuple':
          paramInput.placeholder = 'Enter a tuple, e.g., (1, 2, 3)';
          paramInput.disabled = false;
          break;
        case 'set':
          paramInput.placeholder = 'Enter a set, e.g., {1, 2, 3}';
          paramInput.disabled = false;
          break;
        case 'bool':
          paramInput.placeholder = 'Enter true or false';
          paramInput.disabled = false;
          break;
        case 'NoneType':
          paramInput.placeholder = 'None selected';
          paramInput.value = ''; // Clear the input when disabled
          paramInput.disabled = true; // Disable the input box
          break;
        case 'bytes':
          paramInput.placeholder = 'Enter bytes, e.g., b"hello"';
          paramInput.disabled = false;
          break;
        default:
          paramInput.placeholder = 'Parameter...';
          paramInput.disabled = false;
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

    // Function to update placeholder and behavior based on selected type for expected output
    const updateOutputPlaceholder = () => {
      switch (outputTypeSelect.value) {
        case 'int':
          expectedOutputInput.placeholder = 'Enter a number, e.g., 1';
          expectedOutputInput.disabled = false;
          break;
        case 'float':
          expectedOutputInput.placeholder = 'Enter a decimal number, e.g., 3.14';
          expectedOutputInput.disabled = false;
          break;
        case 'str':
          expectedOutputInput.placeholder = 'Enter text, e.g., hello';
          expectedOutputInput.disabled = false;
          break;
        case 'list':
          expectedOutputInput.placeholder = 'Enter a list, e.g., [1, 2, 3]';
          expectedOutputInput.disabled = false;
          break;
        case 'dict':
          expectedOutputInput.placeholder = 'Enter a dictionary, e.g., {"key": "value"}';
          expectedOutputInput.disabled = false;
          break;
        case 'tuple':
          expectedOutputInput.placeholder = 'Enter a tuple, e.g., (1, 2, 3)';
          expectedOutputInput.disabled = false;
          break;
        case 'set':
          expectedOutputInput.placeholder = 'Enter a set, e.g., {1, 2, 3}';
          expectedOutputInput.disabled = false;
          break;
        case 'bool':
          expectedOutputInput.placeholder = 'Enter true or false';
          expectedOutputInput.disabled = false;
          break;
        case 'NoneType':
          expectedOutputInput.placeholder = '';
          expectedOutputInput.value = ''; // Clear the input when disabled
          expectedOutputInput.disabled = true; // Disable the input box
          break;
        case 'bytes':
          expectedOutputInput.placeholder = 'Enter bytes, e.g., b"hello"';
          expectedOutputInput.disabled = false;
          break;
        case 'error':
          expectedOutputInput.placeholder = '';
          expectedOutputInput.value = ''; // Clear the input when disabled
          expectedOutputInput.disabled = true; // Disable the input box
          break;
        default:
          expectedOutputInput.placeholder = 'Expected output...';
          expectedOutputInput.disabled = false;
          break;
      }
    };

    // Initial call to set the correct placeholder for expected output
    updateOutputPlaceholder();

    // Add an event listener to update the placeholder on type change
    outputTypeSelect.addEventListener('change', updateOutputPlaceholder);

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
  
      let expectedOutput = null;
      const expectedType = li.querySelector('.output-type-select').value;
      switch (expectedType) {
        case 'error':
          expectedOutput = 'error';
          break;
        case 'NoneType':
          expectedOutput = 'none';
          break;
        default:
          expectedOutput = li.querySelector('.test-row input[type="text"]').value;
          break;
      }
  
      tests[JSON.stringify(params)] = [expectedOutput, expectedType];
    });
  
    const jsonData = {
      testfunc: functionName,
      tests: tests,
    };
  
    try {
      const result = await ipcRenderer.invoke('save-json-data', jsonData);
      console.log(result); // Log the success message from the main process
    } catch (error) {
      console.error('Error saving data:', error); // Log error if any occurs
  
      // Check if the error is not an abort error before showing the alert
      if (!error.message.includes('abort')) {
        ipcRenderer.send('show-error-alert', `Error saving test data: ${error}`);
      }
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
      if (!error.message.includes('abort')) {
        ipcRenderer.send('show-error-alert', `Error loading test data: ${error}`);
      }
    }
  });

  // Run Tests button functionality
  runTestBtn.addEventListener('click', () => {
    const resultSummaries = document.querySelectorAll('.result-summary');
    resultSummaries.forEach((summary) => {
      summary.textContent = 'Results: -/- (-%)'; // Reset to default text
      summary.style.color = '#888'; // Optionally reset any color styling
    });

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

  // Function to add a script item to the UI
  function addScriptItem(filePath) {
    if (Object.values(scriptPaths).includes(filePath)) {
      alert('This file has already been added.');
      return;
    }

    const li = document.createElement('li');
    li.className = 'script-item';

    const filename = document.createElement('span');
    filename.className = 'script-filename';
    let textContent = path.basename(filePath);
    if (textContent.length > 64) {
      textContent = textContent.slice(0, 64) + '...';
    }
    filename.textContent = textContent;

    scriptPaths[textContent] = filePath;

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '📝';
    editBtn.title = 'Edit this file';
    editBtn.addEventListener('click', () => {
      ipcRenderer.send('edit-file', scriptPaths[textContent]);
    });

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'scriptremove-btn';
    removeBtn.addEventListener('click', () => {
      delete scriptPaths[textContent];
      li.remove();
    });

    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'summary-container';

    const resultSummary = document.createElement('span');
    resultSummary.className = 'result-summary';
    resultSummary.textContent = 'Results: -/- (-%)';

    const dropdownBtn = document.createElement('button');
    dropdownBtn.textContent = '🔽';
    dropdownBtn.className = 'dropdown-btn';
    dropdownBtn.addEventListener('click', () => {
      const isExpanded = dropdownContent.classList.toggle('show');
      dropdownBtn.textContent = isExpanded ? '🔼' : '🔽';
    });

    summaryContainer.appendChild(resultSummary);
    summaryContainer.appendChild(dropdownBtn);

    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'dropdown-content';

    li.appendChild(filename);
    li.appendChild(editBtn);
    li.appendChild(removeBtn);
    li.appendChild(summaryContainer);
    li.appendChild(dropdownContent);
    scriptsList.appendChild(li);
  }

  // Function to update the test summary UI for each script
  function updateTestSummary(displayName, summary, details) {
    const scriptItems = document.querySelectorAll('.script-item');
    scriptItems.forEach((item) => {
      const filename = item.querySelector('.script-filename').textContent;
      if (filename.includes(displayName)) {
        const resultSummary = item.querySelector('.result-summary');
        const dropdownContent = item.querySelector('.dropdown-content');
        const { passed, total } = summary;
        const percentage = ((passed / total) * 100).toFixed(0);
        resultSummary.textContent = `Results: ${passed}/${total} (${percentage}%)`;

        // Set color based on performance percentage
        if (percentage >= 80) {
          resultSummary.style.color = '#32a852';
        } else if (percentage >= 50) {
          resultSummary.style.color = '#fcba03';
        } else {
          resultSummary.style.color = '#eb4034';
        }

        dropdownContent.innerHTML = '';
        details.forEach((detail) => {
          const detailItem = document.createElement('div');
          detailItem.className = 'detail-item';

          // Format the test result properly
          const resultText = `Test: ${detail.test} - ${detail.passed ? 'Passed' : 'Failed'}`;
          const receivedText = detail.received ? `└─ Got: ${detail.received}` : '└─ Got: undefined';

          // Create and append the main result line
          const resultLine = document.createElement('div');
          resultLine.textContent = resultText;
          detailItem.appendChild(resultLine);

          // Create and append the received line if applicable
          const receivedLine = document.createElement('div');
          receivedLine.textContent = receivedText;
          receivedLine.style.marginLeft = '20px'; // Indent to mimic a nested structure
          detailItem.appendChild(receivedLine);

          dropdownContent.appendChild(detailItem);
        });
      }
    });
  }

  // Listener for test results from the main process
  ipcRenderer.on('test-results', (event, results) => {
    for (const [displayName, result] of Object.entries(results)) {
      updateTestSummary(displayName, result.summary, result.results);
    }
  });

  // Listener to handle opening the file in the default text editor
  ipcRenderer.on('edit-file', (event, filePath) => {
    const { shell } = require('electron');
    shell.openPath(filePath).catch((error) => {
      console.error('Failed to open file:', error);
      if (!error.message.includes('abort')) {
        ipcRenderer.send('show-error-alert', `Failed to open file: ${error}`);
      }
    });
  });

  // Listener for the "Remove All Scripts" button
  if (removeAllScriptsBtn) {
    removeAllScriptsBtn.addEventListener('click', () => {
      showConfirmationDialog('Are you sure you want to remove all scripts?\n\nThis action cannot be undone.', (confirmed) => {
        if (confirmed) {
          // Clear the script paths dictionary
          for (const key in scriptPaths) {
            delete scriptPaths[key];
          }

          // Clear the displayed script list in the UI
          scriptsList.innerHTML = '';
        }
      });
    });
  } else {
    console.error('Remove All Scripts button not found.');
  }

  // Include this in your renderer.js
  function showConfirmationDialog(message, callback) {
    // Modal elements
    const dialog = document.getElementById('confirmation-dialog');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmYesBtn = document.getElementById('confirm-yes');
    const confirmNoBtn = document.getElementById('confirm-no');

    // Set the message
    confirmationMessage.textContent = message;

    // Show the modal
    dialog.style.display = 'block';

    // Save the currently focused element
    const activeElement = document.activeElement;

    // Set focus to the confirm button
    confirmYesBtn.focus();

    // Event handler to capture response
    const handleResponse = (response) => {
      // Hide the modal
      dialog.style.display = 'none';

      // Remove event listeners
      confirmYesBtn.removeEventListener('click', onYes);
      confirmNoBtn.removeEventListener('click', onNo);
      document.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('click', onBackdropClick);

      // Restore focus
      if (activeElement) {
        activeElement.focus();
      }

      // Callback with the user's response
      callback(response);
    };

    const onYes = () => handleResponse(true);
    const onNo = () => handleResponse(false);

    // Keyboard accessibility
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleResponse(false);
      } else if (event.key === 'Enter') {
        handleResponse(true);
      }
    };

    // Close modal if clicking outside content
    const onBackdropClick = (event) => {
      if (event.target === dialog) {
        handleResponse(false);
      }
    };

    // Attach event listeners
    confirmYesBtn.addEventListener('click', onYes);
    confirmNoBtn.addEventListener('click', onNo);
    document.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('click', onBackdropClick);
  }

  // Update your removeAllTestsBtn event listener
  removeAllTestsBtn.addEventListener('click', () => {
    showConfirmationDialog('Are you sure you want to remove all tests?\n\nThis action cannot be undone.', (confirmed) => {
      if (confirmed) {
        // Clear the test list
        while (testList.firstChild) {
          testList.removeChild(testList.firstChild);
        }

        // Add a new test case
        addTestCase([], '', 'any');

        console.log("Finished removing all tests.");
      }
    });
  });
  

  // Get the button
  const backToTopButton = document.querySelector('.back-to-top-btn');
  let isVisible = false;
  
  window.onscroll = function () {
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
      if (!isVisible) {
        backToTopButton.classList.add('show');
        backToTopButton.classList.remove('hide');
        isVisible = true;
      }
    } else {
      if (isVisible) {
        backToTopButton.classList.add('hide');
        backToTopButton.classList.remove('show');
        isVisible = false;
      }
    }
  };
  
  backToTopButton.onclick = function () {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };  
});
