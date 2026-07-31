import { test } from "node:test"
import assert from "node:assert"
import { getProvider } from "../../core/ai/providers/registry.js"
import * as dotenv from 'dotenv';

test("getProvider returns a provider with matching id", (t) => {
    dotenv.config();

    t.test("getProvider returns a provider Google", () =>{
        let GOOGLE_API_KEY: string = process.env.GOOGLE_AI_API as string
        const provider = getProvider("google", GOOGLE_API_KEY)
        assert.equal(provider.id, "google");
    }) 

    t.test("getProvider returns a provider OpenRouter", () =>{
        let OPENROUETER_AI_API: string = process.env.OPENROUETER_AI_API as string
        const provider = getProvider("openRouter", OPENROUETER_AI_API)
        assert.equal(provider.id, "openrouter");
    }) 
});






