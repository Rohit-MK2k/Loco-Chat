//test openrouter provider
import { OpenrouterProvider } from "./openrouter.js";
import { GeminiProvider } from "./gemini.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as dotenv from 'dotenv';

import type { ContentPart, Conversation, Message } from "./types.js";
dotenv.config();


const conversation: Conversation = []

const addTextintoConversation = (text: string, type: "user"|"model"):void =>{
    const contentPart: ContentPart = {
        type: "text",
        text: text
    }

    const message: Message = type === "model"
      ? {
        type: "model_output",
        content: [contentPart]
      }
      : {
        type: "user_input",
        content: [contentPart]
      }

    conversation.push(message)
}

// const OPENROUTER_AI_API = process.env.OPENROUETER_AI_API as string
const GOOGLE_AI_API = process.env.GOOGLE_AI_API as string
const rl = readline.createInterface({ input, output });

export async function chatLoop() {
    try{
        // let chatObj = new OpenrouterProvider(OPENROUTER_AI_API)
        let chatObj = new GeminiProvider(GOOGLE_AI_API)
        console.log(`"Q" or "q" to quit the chat`)

        while (true) {
            const userText = await rl.question("You: ");
            if (userText == "q" || userText == "Q") {
            break;
            }

            addTextintoConversation(userText, "user")

            const message = await chatObj.generateReply(conversation, "gemini-3-flash-preview");

            if (typeof message === "string"){
                addTextintoConversation(message, "model")
            }
            console.log(`AI: ${message}`)
        }
    }catch(err){
        console.log(err)
    }
  
}

chatLoop()
