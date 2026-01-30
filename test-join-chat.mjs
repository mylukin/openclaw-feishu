import { Client } from "@larksuiteoapi/node-sdk";

const client = new Client({
  appId: "cli_a9f3712977bbdbc4",
  appSecret: "9dLqCFPG2NLazia4DllABgk4rAaROpHX",
  appType: 1,
  domain: 0,
});

async function joinChat() {
  const chatId = "oc_eb77ed2f7c7a7482a46ee91165673690";
  
  console.log("Attempting to join chat:", chatId);
  
  try {
    const response = await client.im.chatMembers.meJoin({
      path: { chat_id: chatId }
    });
    
    console.log("Response:", JSON.stringify(response, null, 2));
    
    if (response.code === 0) {
      console.log("✅ Bot joined the chat successfully!");
    } else {
      console.log("❌ Failed:", response.msg);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

joinChat();
