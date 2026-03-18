import { enforcePolicy } from "./src/policy";

console.log("Testing false positive scenario...");

// Test: write_file with content containing "IDENTITY.md" but safe file_path
try {
  enforcePolicy("write_file", { 
    file_path: "safe_file.txt", 
    content: "This file mentions IDENTITY.md in its content" 
  });
  console.log("✓ Allowed write with safe path but content containing IDENTITY.md");
} catch (e) {
  console.log("✗ False positive: denied write with safe path but content containing IDENTITY.md");
  console.log("Error:", e);
}

// Test: read_file doesn't have content, but let's verify it only checks file_path
try {
  enforcePolicy("read_file", { file_path: "safe_file.txt" });
  console.log("✓ Allowed read of safe file");
} catch (e) {
  console.log("✗ Denied read of safe file:", e);
}

// Test: write_file with file_path containing .env pattern should be denied
try {
  enforcePolicy("write_file", { 
    file_path: "config/.env", 
    content: "SECRET=123" 
  });
  console.log("✗ Should have denied write to .env file");
} catch (e) {
  console.log("✓ Denied write to .env file");
}