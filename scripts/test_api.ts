import fetch from "node-fetch";

async function main() {
  const res = await fetch("http://localhost:3000/api/agent/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": "admin_session=true" // If auth is mocked or required
    },
    body: JSON.stringify({
      channelId: "-1001297305044",
      prompt: "Summarize channel stats",
      stream: true,
      thinkingLevel: "off"
    })
  });

  if (!res.ok) {
    console.error("HTTP error:", res.status, await res.text());
    return;
  }

  const reader = res.body;
  if (!reader) { console.error("No body"); return; }
  
  reader.on('data', (chunk) => {
    console.log("CHUNK:", chunk.toString());
  });
}

main().catch(console.error);