import { enforcePolicy } from "./src/policy";

console.log("Testing edit_file false positive scenarios...");

// Test: edit_file with content containing "IDENTITY.md" but safe file_path
try {
  enforcePolicy("edit_file", { 
    file_path: "test.txt", 
    old_string: "old content",
    new_string: "This new content mentions IDENTITY.md and THOUGHTS.md" 
  });
  console.log("✓ Allowed edit with safe path but new_string containing IDENTITY.md");
} catch (e) {
  console.log("✗ FALSE POSITIVE: denied edit with safe path but new_string containing IDENTITY.md");
  console.log("Error:", e);
}

// Test: edit_file with file_path containing .env - should be denied
try {
  enforcePolicy("edit_file", { 
    file_path: "config/.env", 
    old_string: "OLD=123",
    new_string: "NEW=456" 
  });
  console.log("✗ Should have denied edit of .env file");
} catch (e) {
  console.log("✓ Denied edit of .env file");
}

// Test: edit_file with file_path containing /etc/ - should be denied
try {
  enforcePolicy("edit_file", { 
    file_path: "/etc/passwd", 
    old_string: "root:x:0:0",
    new_string: "root:x:0:0:test" 
  });
  console.log("✗ Should have denied edit of /etc/passwd");
} catch (e) {
  console.log("✓ Denied edit of /etc/passwd");
}