import { GoogleGenAI } from "@google/genai";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as dotenv from 'dotenv';
dotenv.config();

const GOOGLE_AI_API = process.env.GOOGLE_AI_API as string


type ContentPart = { type: "text"; text: string };

type UserMessage = { type: "user_input"; content: ContentPart[] }
type ModelOutputMessage = { type: "model_output"; content: ContentPart[] };
type Message =
  | UserMessage
  | ModelOutputMessage 

type Conversation = Message[];

class Chat{
  conversation: Conversation
  provider: GoogleGenAI

  constructor(){
    this.provider = new GoogleGenAI({ apiKey: GOOGLE_AI_API});
    this.conversation = []

  }

  invokeAI = async () => {
    // const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API});
    const interaction = await this.provider.interactions.create({
    store: false,
    model: "gemini-3-flash-preview",
    input: this.conversation,
  })
    return interaction
  }
  
  addUserMessage = (user_message: UserMessage) => {
    // Todo - add the user_input to the coversation Array
    this.conversation.push(user_message)
  }

  addModelMessage = (model_output: ModelOutputMessage) => {
    this.conversation.push(model_output)
  }

  chat = async (user_input: string) => {
    const message: UserMessage = { type: "user_input", content: [{ type: "text", text: user_input }] }
    this.addUserMessage(message)

    const output = await this.invokeAI()

    const output_text = output.output_text as string
    const model_message: ModelOutputMessage = { type: "model_output", content: [{ type: "text", text: output_text }] }
    this.addModelMessage(model_message)
    console.log(`AI: ${output_text}`)
  } 
}

const rl = readline.createInterface({ input, output });

async function chatLoop() {
  let chatObj = new Chat()
  console.log(`"Q" or "q" to quit the chat`)

  while (true) {
    const userText = await rl.question("You: ");
    if (userText == "q" || userText == "Q") {
      break;
    }
    await chatObj.chat(userText);
  }
}

chatLoop()










