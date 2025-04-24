import { parseArgs } from "std/cli/parse_args.ts";
import { z } from "zod";
import { HumanMessage } from "npm:@langchain/core/messages";
import { app } from "./workflow.ts";
import { GraphState } from "./composer.ts";

const ArgsSchema = z.object({
  url: z.string().url("Invalid URL format"),
  question: z.string().min(1, "Question cannot be empty"),
});



async function main() {
  const args = parseArgs(Deno.args, {
    string: ["url", "question"],
    alias: { u: "url", q: "question" },
  });

  try {
    ArgsSchema.parse(args);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors[0].message);
    } else {
      console.error("Error:", error instanceof Error ? error.message : String(error));
    }
    console.error("Usage: deno run start --url=<url> --question=<question>");
    Deno.exit(1);
  }
  const validatedArgs = ArgsSchema.parse(args);
  console.log(`URL: ${validatedArgs.url}`);
  console.log(`Question: ${validatedArgs.question}`);
  const inputs = {
    messages: [
      new HumanMessage(validatedArgs.question),
    ],
  };
  
  let finalState: typeof GraphState.State | undefined;
  for await (const output of await app.stream(inputs)) {
    for (const [key, value] of Object.entries(output)) {
      console.log(`${key} -->`);
      finalState = value as typeof GraphState.State;
    }
  }
  
  if (!finalState) {
    console.error("No response received");
    Deno.exit(1);
  }

  const lastMessage = finalState.messages.at(-1);
  if (!lastMessage) {
    console.error("No message received");
    Deno.exit(1);
  }

  const messageContent = String(lastMessage.content);
  const content = messageContent
    .replace("<think>", "<details><summary>Thinking...</summary>")
    .replace("</think>", "</details>");

  console.log(content);
}

main();