import ast
import sys
import re

# Your existing patterns
DANGEROUS_CALLS = {
    'os.remove': 'File removal operation detected',
    'os.rmdir': 'Directory removal operation detected',
    'shutil.rmtree': 'Recursive directory removal operation detected',
    'subprocess.call': 'Subprocess execution detected',
    'subprocess.Popen': 'Subprocess execution detected',
    'eval': 'Dynamic code execution detected',
    'exec': 'Dynamic code execution detected',
    'compile': 'Dynamic code compilation detected',
    'requests.get': 'Network request detected',
    'requests.post': 'Network request detected',
    'urllib.request': 'Network request detected',
    'http.client': 'HTTP client operation detected',
    'socket': 'Socket operation detected',
    'ftplib': 'FTP operation detected',
    'open': 'File operation detected',
    'getattr': 'Potential dynamic attribute access detected'
}

DANGEROUS_IMPORTS = {
    'os': 'Import of OS module detected, potentially used for file and system operations',
    'shutil': 'Import of shutil module detected, potentially used for file manipulation',
    'subprocess': 'Import of subprocess module detected, potentially used for running system commands',
    'requests': 'Import of requests module detected, potentially used for making network requests',
    'urllib': 'Import of urllib module detected, potentially used for network requests',
    'http.client': 'Import of http.client module detected, potentially used for HTTP operations',
    'socket': 'Import of socket module detected, potentially used for network operations',
    'ftplib': 'Import of ftplib module detected, potentially used for FTP operations',
    'eval': 'Import of eval detected, potentially used for dynamic code execution',
    'exec': 'Import of exec detected, potentially used for dynamic code execution',
    'cryptography': 'Import of cryptography module detected, potentially used for obfuscating code',
    'base64': 'Import of base64 module detected, potentially used for encoding and decoding data',
    'codecs': 'Import of codecs module detected, potentially used for encoding and decoding',
    'zlib': 'Import of zlib module detected, potentially used for compression and obfuscation',
    'importlib': 'Import of importlib detected, potentially used for dynamic imports'
}

SUSPICIOUS_PATTERNS = {
    r'b64decode': 'Base64 decoding detected, potentially used for decoding obfuscated data',
    r'hex': 'Hexadecimal operation detected, potentially used for encoding or obfuscating data',
    r'decode\(': 'Decoding operation detected, potentially used for data obfuscation',
    r'getattr\(': 'Dynamic attribute access detected',
    r'exec\(': 'Execution of dynamic code detected',
    r'eval\(': 'Evaluation of dynamic code detected',
    r'__import__': 'Dynamic import detected',
    r'__builtins__': 'Access to built-ins detected',
    r'__globals__': 'Access to globals detected',
    r'__base__': 'Access to base classes detected',
    r'__mro__': 'Access to method resolution order detected',
    r'__subclasses__': 'Access to subclasses detected',
    r'__dict__': 'Dictionary access to object internals detected',
    r'globals\(\)': 'Access to global namespace detected',
    r'locals\(\)': 'Access to local namespace detected',
    r'importlib': 'Dynamic import library detected',
    r'\\x[0-9a-fA-F]{2}': 'Hex-encoded characters detected',
    r'chr\([0-9]+\)': 'Character code conversion detected'
}

SUSPICIOUS_VARS = {
    'sh': 'Short name potentially hiding shell access',
    'sys': 'System access variable',
    'os': 'Operating system access variable',
    'cmd': 'Command execution variable',
    'proc': 'Process-related variable',
    'popen': 'Process opening variable',
    'shell': 'Shell access variable',
    'exec': 'Execution-related variable',
    'eval': 'Evaluation-related variable'
}

def detect_obfuscated_strings(node: ast.AST) -> str:
    """Check for suspiciously encoded strings that might be hiding malicious code."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        # Check for base64-like strings
        if re.match(r'^[A-Za-z0-9+/=]{20,}$', node.value):
            return f"Suspicious base64-like string detected: '{node.value[:30]}...'"
        # Check for hex strings
        if re.match(r'^[0-9A-Fa-f]+$', node.value):
            return f"Suspicious hex string detected: '{node.value[:30]}...'"
        # Check for strings with lots of backslashes
        if node.value.count('\\') > 5:
            return f"Suspicious escaped string detected: '{node.value[:30]}...'"
    return ''

def get_attribute_chain(node):
    """Extract the full chain of attributes being accessed."""
    attrs = []
    current = node
    while isinstance(current, ast.Attribute):
        attrs.append(current.attr)
        current = current.value
    if isinstance(current, ast.Name):
        attrs.append(current.id)
    return '.'.join(reversed(attrs))

def scan_script(file_path: str) -> list:
    """Scan the given Python file for dangerous operations, obfuscated code, and imports."""
    issues = []

    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            tree = ast.parse(content, filename=file_path)

        # Scan for dangerous function calls and encoded strings
        for node in ast.walk(tree):
            # Check function calls
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                    func_name = f"{node.func.value.id}.{node.func.attr}"
                    if func_name in DANGEROUS_CALLS:
                        issues.append(f"{DANGEROUS_CALLS[func_name]} at line {node.lineno}")

                if isinstance(node.func, ast.Name):
                    for pattern, description in SUSPICIOUS_PATTERNS.items():
                        if re.search(pattern, node.func.id):
                            issues.append(f"{description} at line {node.lineno}")

            # Check variable names
            if isinstance(node, ast.Name):
                if node.id in SUSPICIOUS_VARS:
                    issues.append(f"{SUSPICIOUS_VARS[node.id]} at line {node.lineno}")

            # Check attribute chains
            if isinstance(node, ast.Attribute):
                attr_chain = get_attribute_chain(node)
                if any(pattern in attr_chain for pattern in ['__class__', '__base__', '__subclasses__', '__globals__', '__dict__']):
                    issues.append(f"Suspicious attribute chain detected: {attr_chain} at line {node.lineno}")

            # Check for obfuscated strings
            obfuscation_issue = detect_obfuscated_strings(node)
            if obfuscation_issue:
                issues.append(f"{obfuscation_issue} at line {getattr(node, 'lineno', '?')}")

        # Scan for dangerous imports
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    module_name = alias.name.split('.')[0]
                    if module_name in DANGEROUS_IMPORTS:
                        issues.append(f"{DANGEROUS_IMPORTS[module_name]} at line {node.lineno}")

        # Additional check for suspicious string patterns in the entire file
        for pattern, description in SUSPICIOUS_PATTERNS.items():
            if re.search(pattern, content):
                issues.append(f"{description} found in file content")

        return issues

    except Exception as e:
        return [f"Error scanning file: {str(e)}"]

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python detection_script.py <script_path>")
        sys.exit(1)

    script_path = sys.argv[1]
    issues = scan_script(script_path)
    
    if issues:
        for issue in issues:
            print(f"Warning: {issue}")
    else:
        print("No dangerous functions, obfuscation, or imports detected.")