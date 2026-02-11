import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
console.info("Expo Push Server Started");
Deno.serve(async (req)=>{
  try {
    const payload = await req.json();
    const { record } = payload;
    // 1. Validation (Matches your Messages table)
    if (!record?.user_id || !record?.content) {
      return new Response("Invalid payload", {
        status: 400
      });
    }
    const senderId = record.user_id;
    const messageText = record.content;
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    // 2. Database Query (Matches your Push Tokens table)
    const { data: tokens, error } = await supabase.from("push_tokens").select("token").neq("user_id", senderId); // Broadcast to everyone else
    if (error || !tokens || tokens.length === 0) {
      return new Response("No targets", {
        status: 200
      });
    }
    // 3. Construct Expo Messages
    const messages = tokens.map((t)=>({
        to: t.token,
        sound: "default",
        title: "New Group Message",
        body: messageText,
        data: {
          senderId: senderId
        }
      }));
    // 4. Send in Chunks of 100 (Expo Rule)
    const chunks = [];
    const chunkSize = 100;
    for(let i = 0; i < messages.length; i += chunkSize){
      chunks.push(messages.slice(i, i + chunkSize));
    }
    const results = [];
    // Process all chunks
    for (const chunk of chunks){
      const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(chunk)
      });
      const data = await expoRes.json();
      results.push({
        chunk,
        data
      });
    }
    // 5. Smart Cleanup (Only delete if truly invalid)
    const badTokens = [];
    for (const batch of results){
      const { chunk, data } = batch;
      // Expo returns a 'data' array matching the input order
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((receipt, index)=>{
          if (receipt.status === "error") {
            // ONLY delete if the device is actually unregistered
            if (receipt.details?.error === "DeviceNotRegistered") {
              badTokens.push(chunk[index].to);
            } else {
              console.error(`Expo Error for ${chunk[index].to}:`, receipt.message);
            }
          }
        });
      }
    }
    // Bulk delete invalid tokens
    if (badTokens.length > 0) {
      await supabase.from("push_tokens").delete().in("token", badTokens);
      console.log(`Cleaned up ${badTokens.length} invalid tokens.`);
    }
    return new Response(`Sent ${tokens.length} notifications`, {
      status: 200
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(message, {
      status: 500
    });
  }
});
