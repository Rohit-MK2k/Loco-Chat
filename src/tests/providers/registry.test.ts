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

test("Test the getProvider with valid Key", (t) => {
    t.test("Valid API key to provider Google", async () => {
        let GOOGLE_API_KEY: string = process.env.GOOGLE_AI_API as string
        const provider = getProvider("google", GOOGLE_API_KEY)
        const checkValidKey = await provider.validateApiKey()
        assert.equal(checkValidKey, true);
    })

    t.test("Valid API key to provider OpenRouter", async () => {
        let OPENROUETER_AI_API: string = process.env.OPENROUETER_AI_API as string
        const provider = getProvider("openRouter", OPENROUETER_AI_API)
        const checkValidKey = await provider.validateApiKey()
        assert.equal(checkValidKey, true);
    })
})

test("Test the getProvider with invalid Key", (t) => {
    t.test("invalid API key to provider Google", async () => {
        const provider = getProvider("google", "Fake_API_Key")
        const checkValidKey = await provider.validateApiKey()
        assert.equal(checkValidKey, false);
    })

    t.test("invalid API key to provider OpenRouter", async () => {
        const provider = getProvider("openRouter", "Fake_API_Key")
        const checkValidKey = await provider.validateApiKey()
        assert.equal(checkValidKey, false);
    })
})






