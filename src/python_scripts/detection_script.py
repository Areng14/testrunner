import ast
import sys
import re

# Sets of dangerous function calls, imports, and suspicious obfuscation patterns
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
    'zlib': 'Import of zlib module detected, potentially used for compression and obfuscation'
}

SUSPICIOUS_PATTERNS = {
    r'b64decode': 'Base64 decoding detected, potentially used for decoding obfuscated data',
    r'hex': 'Hexadecimal operation detected, potentially used for encoding or obfuscating data',
    r'decode\(': 'Decoding operation detected, potentially used for data obfuscation',
    r'getattr\(': 'Dynamic attribute access detected',
    r'exec\(': 'Execution of dynamic code detected',
    r'eval\(': 'Evaluation of dynamic code detected'
}

def detect_obfuscated_strings(node: ast.AST) -> str:
    """Check for suspiciously encoded strings that might be hiding malicious code."""
    if isinstance(node, ast.Str):
        if re.match(r'^[A-Za-z0-9+/=]{20,}$', node.s) or re.match(r'^[0-9A-Fa-f]+$', node.s):
            return f"Suspicious encoded string detected: '{node.s[:30]}...'"
    return ''

def scan_script(file_path: str) -> None:
    """Scan the given Python file for dangerous operations, obfuscated code, and imports."""
    issues = []

    try:
        with open(file_path, 'r') as file:
            tree = ast.parse(file.read(), filename=file_path)

        # Scan for dangerous function calls and encoded strings
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if hasattr(node.func, 'attr'):
                    func_name = f"{node.func.value.id}.{node.func.attr}"
                    if func_name in DANGEROUS_CALLS:
                        issues.append(f"{DANGEROUS_CALLS[func_name]} in {file_path} at line {node.lineno}")

                if isinstance(node.func, ast.Name):
                    for pattern, description in SUSPICIOUS_PATTERNS.items():
                        if re.search(pattern, node.func.id):
                            issues.append(f"{description} in {file_path} at line {node.lineno}")

            # Check for suspiciously obfuscated strings
            obfuscation_issue = detect_obfuscated_strings(node)
            if obfuscation_issue:
                issues.append(f"{obfuscation_issue} in {file_path} at line {node.lineno}")

        # Scan for dangerous imports
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    module_name = alias.name.split('.')[0]
                    if module_name in DANGEROUS_IMPORTS:
                        issues.append(f"{DANGEROUS_IMPORTS[module_name]} in {file_path} at line {node.lineno}")

        # Print all detected issues or a safe message
        if issues:
            for issue in issues:
                print(f"Warning: {issue}")
        else:
            print(f"No dangerous functions, obfuscation, or imports detected in {file_path}.")

    except Exception as e:
        print(f"Error scanning {file_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python detection_script.py <script_path>")
        sys.exit(1)

    script_path = sys.argv[1]
    scan_script(script_path)
