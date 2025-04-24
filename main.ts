#!/usr/bin/env -S deno run --allow-net

// Command line tool that accepts a URL and a text question
import { parseArgs } from "std/cli/parse_args.ts";
import { z } from "zod";

const ArgsSchema = z.object({
  url: z.string().url("Invalid URL format"),
  question: z.string().min(1, "Question cannot be empty"),
});

function main() {
  const args = parseArgs(Deno.args, {
    string: ["url", "question"],
    alias: { u: "url", q: "question" },
  });

  try {
    const validatedArgs = ArgsSchema.parse(args);
    console.log(`URL: ${validatedArgs.url}`);
    console.log(`Question: ${validatedArgs.question}`);
    console.log("We'll add actual logic later");
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.errors[0].message);
    } else {
      console.error("Error:", error instanceof Error ? error.message : String(error));
    }
    console.error("Usage: deno run --allow-net main.ts --url=<url> --question=<question>");
    Deno.exit(1);
  }
}

main(); 