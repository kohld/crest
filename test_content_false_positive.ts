import { enforcePolicy } from "./src/policy";

console.log("Testing content false positive scenarios...");

// Test 1: write_file with content containing IDENTITY.md - should be allowed
try {
  enforcePolicy("write_file", { 
    file_path: "test.txt", 
    content: "This file references IDENTITY.md and THOUGHTS.md and BELIEFS.md" 
  });
  console.log("✓ Allowed write with safe path but content containing protected filenames");
} catch (e) {
  console.log("✗ FALSE POSITIVE: denied write with safe path but content containing protected filenames");
  console.log("Error:", e);
}

// Test 2: write_file with file_path containing .env - should be denied
try {
  enforcePolicy("write_file", { 
    file_path: "config/.env", 
    content: "SECRET=123" 
  });
  console.log("✗ Should have denied write to .env file");
} catch (e) {
  console.log("✓ Denied write to .env file");
}

// Test 3: write_file with file_path containing /etc/ - should be denied
try {
  enforcePolicy("write_file", { 
    file_path: "/etc/passwd", 
    content: "test" 
  });
  console.log("✗ Should have denied write to /etc/passwd");
} catch (e) {
  console.log("✓ Denied write to /etc/passwd");
}

// Test 4: run_command with command containing IDENTITY.md - should be denied
try {
  enforcePolicy("run_command", { 
    command: "echo 'test' > IDENTITY.md" 
  });
  console.log("✗ Should have denied shell write to IDENTITY.md");
} catch (e) {
  console.log("✓ Denied shell write to IDENTITY.md");
}

// Test 5: run_command with safe command - should be allowed
try {
  enforcePolicy("run_command", { 
    command: "ls -la" 
  });
  console.log("✓ Allowed ls -la");
} catch (e) {
  console.log("✗ Denied ls -la:", e);
}

// Test 6: read_file with file_path containing .env - should be denied
try {
  enforcePolicy("read_file", { 
    file_path: ".env" 
  });
  console.log("✗ Should have denied read of .env");
} catch (e) {
  console.log("✓ Denied read of .env");
}

// Test 7: read_file with safe path - should be allowed
try {
  enforcePolicy("read_file", { 
    file_path: "README.md" 
  });
  console.log("✓ Allowed read of README.md");
} catch (e) {
  console.log("✗ Denied read of README.md:", e);
}