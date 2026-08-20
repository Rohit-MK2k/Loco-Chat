import test from "node:test"
import assert from "node:assert"
import * as dotenv from "dotenv"

import { Session } from "../../core/ai/session/session.js"
import { setOneActiveProvider } from "../../core/ai/providers/states/connectedProviders.js"
import type { SessionRepository } from "../../core/ai/session/repo/sessionRepository.js"

dotenv.config()

// No-op store — tests don't touch the filesystem
const mockStore: SessionRepository = {
    save: async () => {},
    load: async () => null,
    list: async () => [],
    delete: async () => {},
}

interface ProviderCase {
    id: string,
    envVarName: string,
    apiKey: string | undefined
}
const providerTestCases: ProviderCase[] = [
    { id: "google", envVarName: "GOOGLE_AI_API", apiKey: process.env.GOOGLE_AI_API },
    { id: "openRouter", envVarName: "OPENROUTER_AI_API", apiKey: process.env.OPENROUTER_AI_API ?? process.env.OPENROUETER_AI_API },
]

providerTestCases.forEach(({ id, envVarName, apiKey }) => {
    test(`Session accepts every model advertised by ${id}`, async (t) => {
        if (!apiKey) {
            throw new Error(`${id}'s env variable name ${envVarName} is not set`)
        }

        await setOneActiveProvider(id, apiKey)

        const session = new Session(mockStore)
        const availableModels = await session.getAvailableModels()
        const modelList = availableModels[id] ?? []

        if (modelList.length === 0) {
            throw new Error(`No model found for the provider ${id}`)
        }

        modelList.forEach((modelId) => {
            t.test(`accepts model ${modelId}`, async () => {
                await assert.doesNotReject(() => session.selectModel(id, modelId))
            })
        })
    })
})


test("Session rejects a model that is not offered by the selected provider", async () => {
    const apiKey = process.env.GOOGLE_AI_API

    if (!apiKey) {
        throw new Error("GOOGLE_AI_API is not set")
    }

    await setOneActiveProvider("google", apiKey)

    const session = new Session(mockStore)

    await assert.rejects(
        async () => await session.selectModel("google", "not-a-real-model"),
        /not available for provider/,
    )

    await assert.doesNotReject(async () => await session.selectModel("google", "gemini-3-flash-preview"))
})


