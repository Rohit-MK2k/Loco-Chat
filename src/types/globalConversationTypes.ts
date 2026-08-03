export type GlobalContentPart = { type: "text"; text: string };

export type GlobalUserMessage = { type: "user_input"; content: GlobalContentPart[] }
export type GlobalModelOutputMessage = { type: "model_output"; content: GlobalContentPart[] };
export type GlobalMessage =
  | GlobalUserMessage
  | GlobalModelOutputMessage 

export type GlobalConversation = GlobalMessage[];