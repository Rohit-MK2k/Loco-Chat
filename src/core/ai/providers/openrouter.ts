import type { Conversation, AiProvider } from "./types.ts";


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
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
};



export class OpenrouterProvider implements AiProvider{
    id: string = "openrouter"
    baseURL: string = 'https://openrouter.ai/api/v1/chat/completions'
    private header: Header
    
    
    constructor(
        apiKey: String,
    ){
        this.header = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    }

    listModels(): string[]{
        return ["nvidia/nemotron-3-ultra-550b-a55b:free"]
    }

    private openrouterSetBody(model: string, message: Conversation): OpenRouterConveration{
        return {
            model,
            messages: message.map(({ type, content }) => ({
                role: type === "user_input" ? "user" : "assistant",
                content: content.map(({ text }) => text).join(""),
            })),
        };
    }

    generateReply = async (
        conversation: Conversation, 
        model: string, 
        stream: boolean = true) =>
    {
        const response = await fetch(`${this.baseURL}`, {
            method: 'POST',
            headers: this.header,
            body: JSON.stringify(this.openrouterSetBody(
                model,
                conversation
            ))
        })

        // if(!response.ok){
        //     throw new Error(`Response status: ${response}`);
        // }

        const result = await response.json() as OpenRouterResponse;
        // console.log(result)

        return result.choices?.[0]?.message?.content
    }
}