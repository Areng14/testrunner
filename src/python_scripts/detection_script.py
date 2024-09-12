import ast
import sys
import re

# Sets of dangerous function calls, imports, and suspicious obfuscation patterns
DANGEROUS_CALLS = {
    'os.remove', 'os.rmdir', 'shutil.rmtree', 'subprocess.call', 'subprocess.Popen', 'eval', 'exec', 'compile',
    'requests.get', 'requests.post', 'urllib.request', 'http.client', 'socket', 'ftplib', 'open', 'getattr'
}
DANGEROUS_IMPORTS = {
    'os', 'shutil', 'subprocess', 'requests', 'urllib', 'http.client', 'socket', 'ftplib', 'eval', 'exec',
    'cryptography', 'base64', 'codecs', 'zlib'
}
SUSPICIOUS_PATTERNS = [r'b64decode', r'hex', r'decode\(', r'getattr\(', r'exec\(', r'eval\(']

def detect_obfuscated_strings(node: ast.AST) -> bool:
    """Check for suspiciously encoded strings that might be hiding malicious code."""
    if isinstance(node, ast.Str):
        if re.match(r'^[A-Za-z0-9+/=]{20,}$', node.s) or re.match(r'^[0-9A-Fa-f]+$', node.s):
            print(f"Warning: Suspicious encoded string detected: '{node.s[:30]}...'")
            return True
    return False

def scan_script(file_path: str) -> bool:
    """Scan the given Python file for dangerous operations, obfuscated code, and imports."""
    try:
        with open(file_path, 'r') as file:
            tree = ast.parse(file.read(), filename=file_path)

        # Scan for dangerous function calls and encoded strings
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if hasattr(node.func, 'attr') and f"{node.func.value.id}.{node.func.attr}" in DANGEROUS_CALLS:
                    print(f"Warning: Dangerous function '{node.func.value.id}.{node.func.attr}' found in {file_path} at line {node.lineno}")
                    return False
                for pattern in SUSPICIOUS_PATTERNS:
                    if isinstance(node.func, ast.Name) and re.search(pattern, node.func.id):
                        print(f"Warning: Suspicious function '{node.func.id}' detected in {file_path} at line {node.lineno}")
                        return False

            if detect_obfuscated_strings(node):
                print(f"Warning: Obfuscated string detected in {file_path} at line {node.lineno}")
                return False

        # Scan for dangerous imports
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    if alias.name.split('.')[0] in DANGEROUS_IMPORTS:
                        print(f"Warning: Dangerous or suspicious import '{alias.name}' found in {file_path} at line {node.lineno}")
                        return False

        print(f"No dangerous functions, obfuscation, or imports detected in {file_path}.")
        return True

    except Exception as e:
        print(f"Error scanning {file_path}: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python detection_script.py <script_path>")
        sys.exit(1)

    script_path = sys.argv[1]
    scan_script(script_path)
