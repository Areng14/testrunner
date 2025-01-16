import json
import importlib.util
import ast
import os
import sys
import signal
import resource
import multiprocessing
from contextlib import contextmanager
from typing import Any, Dict, List, Tuple

# Security scanner import (assuming it's in the same directory)
from detection_script import scan_script

class TestingError(Exception):
    """Custom exception for testing-related errors."""
    pass

class SecurityError(Exception):
    """Custom exception for security-related errors."""
    pass

@contextmanager
def timeout(seconds: int):
    """Context manager for timing out function execution."""
    def signal_handler(signum, frame):
        raise TimeoutError(f"Function execution timed out after {seconds} seconds")
    
    # Set signal handler
    signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)

def set_resource_limits():
    """Set resource limits for memory and CPU."""
    # 50MB memory limit
    memory_limit = 50 * 1024 * 1024
    try:
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
        # 5 seconds CPU time
        resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
        # No subprocess creation
        resource.setrlimit(resource.RLIMIT_NPROC, (0, 0))
        # No file creation
        resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    except (resource.error, ValueError) as e:
        raise SecurityError(f"Failed to set resource limits: {str(e)}")

def load_tests(json_path: str) -> dict:
    """Load the JSON file containing the function name and test cases."""
    try:
        with open(json_path, 'r') as file:
            return json.load(file)
    except json.JSONDecodeError as e:
        raise TestingError(f"Invalid JSON format in test file: {str(e)}")
    except Exception as e:
        raise TestingError(f"Failed to load test file: {str(e)}")

def load_function_from_path(script_path: str, function_name: str) -> Any:
    """Safely load a function from a Python script file."""
    try:
        # First run security scan
        security_issues = scan_script(script_path)
        if security_issues:
            raise SecurityError("Security scan detected potential issues in the code")

        # Load the module in a separate process
        def load_module():
            try:
                set_resource_limits()
                module_name = os.path.splitext(os.path.basename(script_path))[0]
                spec = importlib.util.spec_from_file_location(module_name, script_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if not hasattr(module, function_name):
                    raise AttributeError(f"Function '{function_name}' not found in module")
                return getattr(module, function_name)
            except Exception as e:
                return e

        # Run in separate process with timeout
        process = multiprocessing.Process(target=load_module)
        process.start()
        process.join(timeout=5)  # 5 second timeout for loading

        if process.is_alive():
            process.terminate()
            raise SecurityError("Module loading timed out - possible infinite loop or resource exhaustion")

        if not process.exitcode == 0:
            raise SecurityError("Failed to load module safely")

        return load_module()

    except Exception as e:
        if isinstance(e, SecurityError):
            raise
        raise TestingError(f"Failed to load function: {str(e)}")

def safe_run_in_process(func: callable, args: tuple) -> dict:
    """Run function in a separate process with resource limits."""
    def runner():
        try:
            set_resource_limits()
            result = func(*args)
            return {"result": result, "passed": True}
        except Exception as e:
            return {"result": str(e), "passed": False}

    process = multiprocessing.Process(target=runner)
    process.start()
    process.join(timeout=5)  # 5 second timeout

    if process.is_alive():
        process.terminate()
        return {"result": "Function execution timed out", "passed": False}

    if not process.exitcode == 0:
        return {"result": "Function crashed", "passed": False}

    return runner()

def parse_arg(arg: tuple) -> Any:
    """Safely parse argument based on type information."""
    try:
        value, type_ = arg
        type_mapping = {
            'int': int,
            'float': float,
            'str': str,
            'bool': lambda x: x.lower() == 'true',
            'list': json.loads,
            'dict': json.loads,
            'tuple': lambda x: tuple(json.loads(x)),
            'set': lambda x: set(json.loads(x)),
            'NoneType': lambda x: None,
            'bytes': lambda x: bytes(x, encoding='utf-8')
        }

        if type_ not in type_mapping:
            raise ValueError(f"Unsupported type: {type_}")

        return type_mapping[type_](value)
    except Exception as e:
        raise TestingError(f"Failed to parse argument {arg}: {str(e)}")

def run_function(func: callable, params: str, expected_error: bool = False) -> dict:
    """Safely run the specified function with given parameters."""
    try:
        arguments = [parse_arg(arg) for arg in ast.literal_eval(params)]
        result = safe_run_in_process(func, tuple(arguments))

        if expected_error:
            return {"result": "error" if not result["passed"] else f"Expected error but got {result['result']}", 
                   "passed": not result["passed"]}
        
        return result
    except Exception as e:
        if expected_error:
            return {"result": "error", "passed": True}
        return {"result": str(e), "passed": False}

def check_test_in_file(script_path: str, tests: dict) -> list:
    """Check the specified Python file for tests and return results."""
    results = []
    function_name = tests.get("testfunc")

    if not function_name:
        return [{"test": "Invalid function name", "passed": False, 
                "error": "Missing 'testfunc' key."}]

    try:
        func = load_function_from_path(script_path, function_name)
        if isinstance(func, Exception):
            return [{"test": function_name, "passed": False, 
                    "error": f"Failed to load function: {str(func)}"}]

        for param, expected_output in tests.get("tests", {}).items():
            expected_value, expected_type = parse_expected(expected_output)
            output = run_function(func, param, expected_error=(expected_type == 'error'))
            
            test_result = {
                "test": f"{param} => {expected_value}",
                "passed": output["passed"] and (output["result"] == expected_value 
                                              if expected_type != 'error' else True),
                "received": output["result"],
                "error": output["result"] if not output["passed"] else None,
            }
            results.append(test_result)

    except SecurityError as e:
        results.append({
            "test": "Security Check",
            "passed": False,
            "error": str(e)
        })
    except Exception as e:
        results.append({
            "test": "Testing Error",
            "passed": False,
            "error": str(e)
        })

    return results

def parse_expected(expected: list) -> tuple:
    """Parse the expected output from JSON and determine its type."""
    try:
        value, type_str = expected
        type_mapping = {
            'int': int,
            'float': float,
            'str': str,
            'bool': bool,
            'tuple': tuple,
            'set': set,
            'list': list,
            'dict': dict,
            'NoneType': type(None),
            'bytes': bytes,
            'error': 'error'
        }

        expected_type = type_mapping.get(type_str, str)

        if type_str == 'bytes':
            return bytes(value, encoding='utf-8'), expected_type
        if type_str == 'error':
            return "error", 'error'
        if type_str == 'NoneType':
            return None, type(None)
        if type_str in ['list', 'tuple', 'set', 'dict']:
            return expected_type(json.loads(value)), expected_type

        return expected_type(value), expected_type
    except Exception as e:
        return str(e), str

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python test.py <json_path> <script_path>"}))
        sys.exit(1)

    json_path = sys.argv[1]
    script_path = sys.argv[2]

    if not os.path.isfile(json_path) or not os.path.isfile(script_path):
        print(json.dumps({
            "error": "Invalid file paths. Please provide valid JSON and Python script paths."
        }))
        sys.exit(1)

    try:
        test_data = load_tests(json_path)
        results = check_test_in_file(script_path, test_data)
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps([{
            "test": "System Error",
            "passed": False,
            "error": str(e)
        }]))