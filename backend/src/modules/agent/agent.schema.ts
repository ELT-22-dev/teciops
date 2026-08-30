import { z } from "zod";

export const askAgentSchema = z.object({
  message: z.string().min(1, "Mensagem obrigatoria")
});
