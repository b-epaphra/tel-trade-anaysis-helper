const rawChunk = `data: {"type":"tool_start","toolCallId":"call_1","toolName":"get_channel_stats","args":{}}

data: {"type":"tool_end","toolCallId":"call_1","toolName":"get_channel_stats","result":{"stats":"good"}}

data: {"type":"text_delta","delta":"Here are "}

data: {"type":"text_delta","delta":"the stats."}

`;

const decoder = new TextDecoder("utf-8");
let buffer = rawChunk; // Simulate received buffer

const rawLines = buffer.split(/\r?\n/);
buffer = rawLines.pop() || "";

console.log("Raw lines:", rawLines);

for (const line of rawLines) {
  const cleanLine = line.trim();
  if (!cleanLine.startsWith("data:")) continue;
  const jsonStr = cleanLine.replace(/^data:\s*/, "");
  if (!jsonStr) continue;

  try {
    const event = JSON.parse(jsonStr);
    console.log("Parsed event:", event.type);
  } catch (err) {
    console.error("Parse error:", err.message, "on string:", jsonStr);
  }
}