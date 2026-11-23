import { z } from "zod"
import { categories, difficulties, kinds } from "./model"

const name = z.string().trim().min(1).max(80)
const id = z.uuid()
const category = z.enum(categories)
const duration = z.number().int().min(1).max(180)
const reward = z.number().int().min(1).max(500)
const reminder = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()
const schedule = {
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  reminder,
}
const credentials = { email: z.email().max(254), password: z.string().min(8).max(72) }
export const authSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), ...credentials }),
  z.object({ action: z.literal("register"), ...credentials, name: name.max(60) }),
  z.object({ action: z.literal("logout") }),
])
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("custom"), name, category, duration, ...schedule }),
  z.object({ action: z.literal("template"), id, ...schedule }),
  z.object({ action: z.literal("archive"), id }),
  z.object({ action: z.literal("reminder"), id, reminder }),
  z.object({ action: z.literal("log"), id, minutes: duration.nullable() }),
  z.object({ action: z.literal("quest"), id, control: z.enum(["start", "pause", "resume", "cancel", "finish"]) }),
  z.object({ action: z.literal("role"), id, role: z.enum(["user", "admin"]) }),
  z.object({ action: z.literal("saveTemplate"), id: id.optional(), name, category, difficulty: z.enum(difficulties), duration, reward, active: z.boolean() }),
  z.object({ action: z.literal("savePool"), id: id.optional(), name, category: category.nullable(), kind: z.enum(kinds), reward, badge: z.string().min(1).max(80), active: z.boolean() }),
])
export type Command = z.infer<typeof commandSchema>
export const chatSchema = z.object({ threadId: z.uuid(), message: z.string().trim().min(1).max(2000) })
export const chatQuerySchema = z.object({
  threadId: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})
