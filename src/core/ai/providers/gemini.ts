import { GoogleGenAI } from "@google/genai";
import type { AiProvider } from "./types.ts";
import type { GlobalConversation } from "../../../types/globalConversationTypes.js";


type GeminiConversation = {
    role: "user" | "model",
    parts: { text: string }[]
}

export class GeminiProvider implements AiProvider {
    private client: GoogleGenAI
    id:string = "google"

    constructor(
        apiKey: string,
    ){
        this.client = new GoogleGenAI({ apiKey })
    }

    validateApiKey= async(): Promise<boolean> => {
        try{
            await this.client.models.list()
            return true
        }catch {
            return false
        }
    }

    listModels = async (): Promise<string[]> => {
        const response = await this.client.models.list()

        return response.page
            .filter(({ supportedActions }) => supportedActions?.includes("generateContent"))
            .map(({ name, displayName }) => name ?? displayName)
            .filter((model): model is string => Boolean(model))
    }

    private buildGeminiConveration = (conversation: GlobalConversation): GeminiConversation[] =>{
        return conversation.map(({ type, content }) => ({
            role: type === "user_input" ? "user" : "model",
            parts: content.map(({ text }) => ({ text })),
        }))
    }

    generateReply = async (
        conversation:  GlobalConversation, 
        model: string
    ): Promise<string> => {
        const response = await this.client.models.generateContent({
            model,
            contents: this.buildGeminiConveration(conversation),
        })
        
        return response.text as string
    }
}