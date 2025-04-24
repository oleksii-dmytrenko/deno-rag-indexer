import { ChatPromptTemplate } from "npm:@langchain/core/prompts";
import { ChatOllama } from "npm:@langchain/ollama";
import { BaseMessage, isAIMessage, isToolMessage } from "npm:@langchain/core/messages";
import { END } from "npm:@langchain/langgraph";
import { z } from "npm:zod";
import { GraphState } from "./composer.ts";
import { StructuredOutputParser } from "npm:@langchain/core/output_parsers";
import { getRetriever } from "./retriever.ts";
import { createRetrieverTool } from "npm:langchain/tools/retriever";

export function shouldRetrieve(state: typeof GraphState.State): string {
    console.log("---DECIDE TO RETRIEVE---");
    const { messages } = state;
    const lastMessage = messages.at(-1) as BaseMessage;
  
    if (isAIMessage(lastMessage) && lastMessage.tool_calls?.length) {
      console.log("---DECISION: RETRIEVE---");
      return "retrieve";
    }
  
    return END;
}

export async function gradeDocuments(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
  console.log("---GET RELEVANCE---");

  const tool = {
    name: "give_relevance_score",
    description: "Give a relevance score to the retrieved documents.",
    schema: z.object({
      binaryScore: z.string().describe("Relevance score 'yes' or 'no'"),
    }),
  };

  const outputSchema = z.object({
    binaryScore: z.string().describe("Relevance score 'yes' or 'no'"),
  });

  const parser = StructuredOutputParser.fromZodSchema(outputSchema);

  const prompt = ChatPromptTemplate.fromTemplate(`
    You are a grader assessing relevance of retrieved docs to a user question.
    Here are the retrieved docs:
    
    -------
  
    {context} 
    
    -------
  
    Here is the user question: {question}
  
    If the content of the docs are relevant to the users question, score them as relevant.
    Give a binary score 'yes' or 'no' score to indicate whether the docs are relevant to the question.
    Yes: The docs are relevant to the question.
    No: The docs are not relevant to the question.
  `);

  const model = new ChatOllama({
    model: "llama3.2:3b",
    temperature: 0,
  }).bindTools([tool]);

  const { messages } = state;
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];

  const formattedPrompt = await prompt.format({
    question: firstMessage.content as string,
    context: lastMessage.content as string,
  });

  const response = await model.invoke(formattedPrompt);
  console.log("Response Grade:", response);
  return { messages: [response] }
}


export async function rewrite(
    state: typeof GraphState.State,
  ): Promise<Partial<typeof GraphState.State>> {
    console.log("---TRANSFORM QUERY---");
  
    const { messages } = state;
    const question = messages[0].content as string;
    const prompt = ChatPromptTemplate.fromTemplate(
      `Look at the input and try to reason about the underlying semantic intent / meaning.
  
  Here is the initial question:
  
  -------
  
  {question} 
  
  -------
  
  Formulate an improved question:`,
    );
  
    // Grader
    const model = new ChatOllama({
      model: "deepseek-r1:8b",
      temperature: 0,
      streaming: true,
    });
    const formattedPrompt = await prompt.format({
      question,
    });
    const response = await model.invoke(formattedPrompt);

    return {
        messages: [response],
    };
  }

  export async function generate(
    state: typeof GraphState.State,
  ): Promise<Partial<typeof GraphState.State>> {
    console.log("---GENERATE---");
  
    const { messages } = state;
    const question = messages[0].content as string;
    // Extract the most recent ToolMessage
    const lastToolMessage = messages.slice().reverse().find((msg) =>
      isToolMessage(msg)
    );
    if (!lastToolMessage) {
      throw new Error("No tool message found in the conversation history");
    }
  
    const context = lastToolMessage.content as string;
  
    const prompt = ChatPromptTemplate.fromTemplate(
      `You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.
  
  Here is the initial question:
  
  -------
  
  {question}
  
  -------
  
  Here is the context that you should use to answer the question:
  
  -------
  
  {context}
  
  -------
  
  Answer:`,
    );
  
    const llm = new ChatOllama({
      model: "deepseek-r1:8b",
      temperature: 0,
      streaming: true,
    });

    const formattedPrompt = await prompt.format({
      question,
      context,
    });

    const response = await llm.invoke(formattedPrompt);
  
    return {
      messages: [response],
    };
  }

  export async function agent(
    state: typeof GraphState.State,
  ): Promise<Partial<typeof GraphState.State>> {
    console.log("---CALL AGENT---");
  
    const { messages } = state;
    const filteredMessages = messages.filter((message) => {
      if (isAIMessage(message) && message.tool_calls?.length) {
        return message.tool_calls[0].name !== "give_relevance_score";
      }
      return true;
    });
    const retriever = await getRetriever();

    const tool = createRetrieverTool(retriever, {
        name: "retrieve_blog_posts",
        description: "Search and return information about Deno from various blog posts.",
      },
    );
    const tools = [tool];
    const model = new ChatOllama({
      model: "llama3.2:3b",
      temperature: 0,
      streaming: true,
    }).bindTools(tools);
  
    const response = await model.invoke(filteredMessages);
    return {
      messages: [response],
    };
  }

  export function checkRelevance(state: typeof GraphState.State): "yes" | "no" {
    console.log("---CHECK RELEVANCE---");
  
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if (!isAIMessage(lastMessage)) {
      throw new Error(
        "The 'checkRelevance' node requires the most recent message to be an AI message.",
      );
    }
  
    const { tool_calls: toolCalls } = lastMessage;
    if (!toolCalls || !toolCalls.length) {
      console.log("message", lastMessage);
      console.log("toolCalls", toolCalls);
      throw new Error(
        "The 'checkRelevance' node requires the most recent message to contain tool calls.",
      );
    }
  
    if (toolCalls[0].args.binaryScore === "yes") {
      console.log("---DECISION: DOCS RELEVANT---");
      return "yes";
    }
    console.log("---DECISION: DOCS NOT RELEVANT---");
    return "no";
  }

