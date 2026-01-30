import { Client } from "@larksuiteoapi/node-sdk";

const client = new Client({
  appId: "cli_a9f3712977bbdbc4",
  appSecret: "9dLqCFPG2NLazia4DllABgk4rAaROpHX",
  appType: 1,
  domain: 0,
});

async function testDownload() {
  const messageId = "om_x100b58969b17d8a4b2018eabcccb5f7";
  const fileKey = "file_v3_00uc_066fc9b8-2413-4350-9489-9d1e53b0794g";

  console.log("Testing messageResource.get...");
  
  try {
    const response = await client.im.messageResource.get({
      params: { type: "audio" },
      path: { message_id: messageId, file_key: fileKey }
    });
    
    console.log("Response type:", typeof response);
    console.log("Has code?", response.code !== undefined);
    console.log("Has getReadableStream?", typeof response.getReadableStream === 'function');
    
    if (response.getReadableStream) {
      const stream = response.getReadableStream();
      console.log("Stream readable:", stream.readable);
    }
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Response data:", error.response?.data);
  }
}

testDownload();
