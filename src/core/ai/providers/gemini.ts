import { GoogleGenAI } from "@google/genai";
import type { AiProvider, Conversation } from "./types.ts";

export class GeminiProvider implements AiProvider {
    private client: GoogleGenAI
    id:string = "google"

    constructor(
        apiKey: string,
    ){
        this.client = new GoogleGenAI({ apiKey })
    }

    listModels(): string[] {
        return ["gemini-3-flash-preview"]
    }

    generateReply = async (
        conversation: Conversation, 
        model: string
    )=> {
        const text_response =  await this.client.interactions.create({
            store: false,
            model: model,
            input: conversation,
        })
        
        return text_response.output_text
    }
}