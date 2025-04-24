import { parseArgs } from "std/cli/parse_args.ts";
import { z } from "zod";
import { HumanMessage } from "npm:@langchain/core/messages";
import { app } from "./workflow.ts";

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
  
  let finalState: any;
  for await (const output of await app.stream(inputs)) {
    for (const [key, value] of Object.entries(output)) {
      console.log(`${key} -->`);
      finalState = value;
    }
  }
  
  const lastMessage = finalState.messages[finalState.messages.length - 1];
  const content = lastMessage.content
    .replace("<think>", "<details><summary>Thinking...</summary>")
    .replace("</think>", "</details>");

  console.log(content)
}

main();