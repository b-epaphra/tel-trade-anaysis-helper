import { verifyAdminAuth } from "../src/lib/auth";

const mockReqLocalhost = new Request("http://localhost:3000/api/agent/chat", {
  method: "POST",
  headers: {
    "host": "localhost:3000"
  }
});

const result = verifyAdminAuth(mockReqLocalhost);
console.log("Localhost request auth result:", result);

const mockReqWithPass = new Request("http://example.com/api/agent/chat", {
  method: "POST",
  headers: {
    "x-admin-password": "admin123"
  }
});

const result2 = verifyAdminAuth(mockReqWithPass);
console.log("Header auth result:", result2);