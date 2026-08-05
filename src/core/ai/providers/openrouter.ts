import type { AiProvider } from "./types.ts";
import type { GlobalConversation } from "../../../types/globalConversationTypes.js";


type Header = {
    Authorization: string,
    'HTTP-Referer'?: string,
    'X-OpenRouter-Title'?: string,
    'Content-Type': 'application/json'

}

type OpenRouterMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};
interface OpenRouterConveration {
  model: string;
  messages: OpenRouterMessage[];
};
type OpenRouterResponse = {
    choices: Array<{
        message: {
            content?: string;
        };
    }>;
};



export class OpenrouterProvider implements AiProvider{
    id: string = "openrouter"
    baseURL: string = 'https://openrouter.ai/api/v1/chat/completions'
    private header: Header
    
    
    constructor(
        apiKey: string,
    ){
        this.header = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    }

    listModels(): string[]{
        return ["nvidia/nemotron-3-ultra-550b-a55b:free"]
    }

    validateApiKey= async(): Promise<boolean> => {
        const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: this.header
        })

        return response.ok
    }

    private openrouterSetBody(model: string, message: GlobalConversation): OpenRouterConveration{
        return {
            model,
            messages: message.map(({ type, content }) => ({
                role: type === "user_input" ? "user" : "assistant",
                content: content.map(({ text }) => text).join(""),
            })),
        };
    }

    generateReply = async (
        conversation: GlobalConversation, 
        model: string, 
    ) =>
    {
        const response = await fetch(`${this.baseURL}`, {
            method: 'POST',
            headers: this.header,
            body: JSON.stringify(this.openrouterSetBody(
                model,
                conversation
            ))
        })

        if(!response.ok){
            throw new Error(`Response status: ${response}`);
        }

        const result = await response.json() as OpenRouterResponse;

        return result.choices?.[0]?.message?.content
    }
}