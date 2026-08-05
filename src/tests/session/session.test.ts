import test from "node:test"
import assert from "node:assert"
import * as dotenv from "dotenv"

import { Session } from "../../core/ai/session/session.js"
import { setOneActiveProvider } from "../../core/ai/providers/states/connectedProviders.js"
import { listSelectedProviderModels, selectProvider } from "../../core/ai/providers/states/activeSelection.js"


dotenv.config()

interface ProviderCase {
    id: string,
    envVarName: string,
    apiKey: string | undefined
}
const providerTestCases: ProviderCase[] = [
    { id: "google", envVarName: "GOOGLE_AI_API", apiKey: process.env.GOOGLE_AI_API},
    { id: "openRouter", envVarName: "OPENROUETER_AI_API", apiKey: process.env.OPENROUETER_AI_API},
]

providerTestCases.forEach(({ id, envVarName, apiKey }) => {
    test(`Session accepts every model advertised by ${id}`, async (t) => {
        if (!apiKey) {
            throw new Error(`${id}'s env varible name ${envVarName} is not set`)
        }

        await setOneActiveProvider(id, apiKey)
        selectProvider(id)

        const session = new Session()
        const providerModelIdList = await listSelectedProviderModels()

        if (providerModelIdList.length === 0) {
            throw new Error(`No model found for the provider ${id}`)
        }

        providerModelIdList.forEach((modelId) => {
            t.test(`accepts model ${modelId}`, () => {
                assert.doesNotThrow(() => session.selectModel(modelId))
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
    selectProvider("google")

    const session = new Session()

    assert.rejects(
        async () => await session.selectModel("not-a-real-model"),
        /not available for the provider/,
    )

    assert.doesNotThrow(async () => await session.selectModel("models/gemini-3-flash-preview"))
})
