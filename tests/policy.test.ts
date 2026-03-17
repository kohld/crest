import { evaluatePolicy, PolicyViolationError, enforcePolicy } from "../src/policy";

console.log("Testing policy module...");

// Test 1: Deny dangerous run_command patterns
try {
  enforcePolicy("run_command", { command: "rm -rf /" });
  console.log("FAIL: Should have denied rm -rf");
} catch (e) {
  if (e instanceof PolicyViolationError) {
    console.log("✓ Denied rm -rf command");
  } else {
    console.log("FAIL: Wrong error type", e);
  }
}

// Test 2: Allow safe run_command
try {
  enforcePolicy("run_command", { command: "ls -la" });
  console.log("✓ Allowed ls -la");
} catch (e) {
  console.log("FAIL: Should have allowed ls -la", e);
}

// Test 3: Deny write to protected file
try {
  enforcePolicy("write_file", { file_path: "IDENTITY.md", content: "test" });
  console.log("FAIL: Should have denied write to IDENTITY.md");
} catch (e) {
  if (e instanceof PolicyViolationError) {
    console.log("✓ Denied write to IDENTITY.md");
  } else {
    console.log("FAIL: Wrong error type", e);
  }
}

// Test 4: Allow write to non-protected file
try {
  enforcePolicy("write_file", { file_path: "test.txt", content: "hello" });
  console.log("✓ Allowed write to test.txt");
} catch (e) {
  console.log("FAIL: Should have allowed write to test.txt", e);
}

// Test 5: Deny read of sensitive file
try {
  enforcePolicy("read_file", { file_path: ".env" });
  console.log("FAIL: Should have denied read of .env");
} catch (e) {
  if (e instanceof PolicyViolationError) {
    console.log("✓ Denied read of .env");
  } else {
    console.log("FAIL: Wrong error type", e);
  }
}

// Test 6: Allow read of normal file
try {
  enforcePolicy("read_file", { file_path: "README.md" });
  console.log("✓ Allowed read of README.md");
} catch (e) {
  console.log("FAIL: Should have allowed read of README.md", e);
}

// Test 7: Deny shell command that tries to write to protected file
try {
  enforcePolicy("run_command", { command: "echo 'test' > THOUGHTS.md" });
  console.log("FAIL: Should have denied shell write to THOUGHTS.md");
} catch (e) {
  if (e instanceof PolicyViolationError) {
    console.log("✓ Denied shell write to THOUGHTS.md");
  } else {
    console.log("FAIL: Wrong error type", e);
  }
}

// Test 8: Deny write_file to system directory
try {
  enforcePolicy("write_file", { file_path: "/etc/passwd", content: "test" });
  console.log("FAIL: Should have denied write to /etc/passwd");
} catch (e) {
  if (e instanceof PolicyViolationError) {
    console.log("✓ Denied write to /etc/passwd");
  } else {
    console.log("FAIL: Wrong error type", e);
  }
}

console.log("Policy tests completed.");
