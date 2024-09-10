import json
import importlib.util
import ast
import os
import sys

def load_tests(json_path: str) -> dict:
    """Load the JSON file containing the function name and test cases."""
    with open(json_path, 'r') as file:
        return json.load(file)

def load_function_from_path(script_path: str, function_name: str):
    """Load a function from a Python script file."""
    try:
        module_name = os.path.splitext(os.path.basename(script_path))[0]
        spec = importlib.util.spec_from_file_location(module_name, script_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        func = getattr(module, function_name)
        return func
    except Exception as e:
        return None

def run_function(func, params: str):
    """Run the specified function with given parameters."""
    try:
        arguments = [parse_arg(arg) for arg in ast.literal_eval(params)]
        result = func(*arguments)
        return {"result": result, "passed": True}
    except Exception as e:
        return {"result": str(e), "passed": False}

def parse_arg(arg):
    """Parse argument based on type information."""
    value, type_ = arg
    if type_ == 'int':
        return int(value)
    elif type_ == 'float':
        return float(value)
    elif type_ == 'str':
        return value
    elif type_ == 'bool':
        return value.lower() == 'true'
    elif type_ == 'list':
        return json.loads(value)
    elif type_ == 'dict':
        return json.loads(value)
    elif type_ == 'tuple':
        return tuple(json.loads(value))
    elif type_ == 'set':
        return set(json.loads(value))
    elif type_ == 'NoneType':
        return None
    elif type_ == 'bytes':
        return bytes(value, encoding='utf-8')
    return value

def check_test_in_file(script_path: str, tests: dict) -> list:
    """Check the specified Python file for tests and return results."""
    function_name = tests.get("testfunc")
    results = []

    if not function_name:
        results.append({"test": "Invalid function name", "passed": False, "error": "Missing 'testfunc' key."})
        return results

    func = load_function_from_path(script_path, function_name)
    if not func:
        results.append({"test": function_name, "passed": False, "error": "Function not found."})
        return results

    for param, expected_output in tests.get("tests", {}).items():
        expected_value, expected_type = parse_expected(expected_output)
        output = run_function(func, param)
        test_result = {
            "test": f"{param} => {expected_value}",
            "passed": output["passed"] and output["result"] == expected_value,
            "error": output["result"] if not output["passed"] else None,
        }
        results.append(test_result)

    return results

def parse_expected(expected: list):
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
            'NoneType': type(None),
            'bytes': bytes,
        }
        expected_type = type_mapping.get(type_str, str)
        if type_str == 'bytes':
            return bytes(value, encoding='utf-8'), expected_type
        return expected_type(value), expected_type
    except Exception:
        return expected, str

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python test.py <json_path> <script_path>"}))
        sys.exit(1)

    json_path = sys.argv[1]
    script_path = sys.argv[2]

    if not os.path.isfile(json_path) or not os.path.isfile(script_path):
        print(json.dumps({"error": "Invalid file paths. Please provide valid JSON and Python script paths."}))
        sys.exit(1)

    test_data = load_tests(json_path)
    results = check_test_in_file(script_path, test_data)

    # Output results in JSON format
    print(json.dumps(results))
