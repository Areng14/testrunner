# Testrunner

Testrunner is an Electron-based application designed to test multiple Python scripts using JSON-defined test cases. The project provides an intuitive interface to manage scripts, run tests, and view results in a user-friendly format.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Usage](#usage)
  - [Loading Scripts](#loading-scripts)
  - [Running Tests](#running-tests)
  - [Viewing Test Results](#viewing-test-results)
  - [Editing Scripts](#editing-scripts)
- [File Structure](#file-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Script Management**: Easily add, edit, and remove Python scripts for testing.
- **JSON-based Testing**: Define test cases using a JSON format, making it easy to structure and automate your testing scenarios.
- **Detailed Test Results**: View pass/fail statuses for each test, along with specific errors if a test fails.
- **Expand/Collapse Results**: Toggle detailed views for each test, showing input, expected output, actual output, and error messages.
- **Dark Mode**: Toggle between light and dark themes to suit your environment.
- **File Management**: Save and load test cases, allowing you to reuse or share test configurations easily.

## Getting Started

### Prerequisites

- **Node.js**: Ensure you have Node.js installed. You can download it from [nodejs.org](https://nodejs.org/).
- **Python**: The application runs Python scripts, so Python should be installed on your system.

### Installation

Clone the repository and install the required dependencies:

```bash
git clone https://github.com/areng14/testrunner.git
cd testrunner
npm install
```

### Running the Application

Start the Electron application using:

```bash
npm start
```

## Usage

### Loading Scripts

1. Click the **"Add Script"** button to select Python files from your local machine.
2. Added scripts will appear in the list with options to edit or remove them.

### Running Tests

1. Load or define your tests using the **Tests Editor** tab.
2. Click **"Run Tests"** to execute the defined tests against the loaded scripts.
3. Results will be displayed for each script, showing pass/fail status.

### Viewing Test Results

- Expand each script item to view detailed results for each test case.
- Results include:
  - Test input parameters
  - Expected output vs. actual output
  - Error messages if a test fails

### Editing Scripts

- Click the **Edit** button on any script to open it in your default text editor.
- Make necessary changes and save; the application will use the updated script for testing.

## File Structure

- **index.html**: Main structure of the app, including UI elements for script management and test results.
- **styles.css**: Styling for the application, including theme settings, layout adjustments, and responsive design tweaks.
- **main.js**: Electron backend script that handles window creation, file dialogs, and communication between frontend and backend.
- **renderer.js**: Frontend script responsible for handling user interactions, updating the UI, and communicating with the backend for test execution.
- **tester.js**: Script handling the execution of Python tests based on JSON configuration and returning results.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your improvements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

This README provides a comprehensive overview of your Electron-based test runner application. Feel free to adjust any section to better fit your project's specifics or any additional features you might want to highlight!
