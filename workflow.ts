import { START, END } from "npm:@langchain/langgraph";
import { ToolNode } from "npm:@langchain/langgraph/prebuilt";
import { StateGraph } from "@langchain/langgraph";
import { createRetrieverTool } from "npm:langchain/tools/retriever";
import { getRetriever } from "./retriever.ts";
import { GraphState } from "./composer.ts";
import { agent, gradeDocuments, rewrite, generate } from "./actions.ts";
import { shouldRetrieve, checkRelevance } from "./actions.ts";

const retriever = await getRetriever();

const tool = createRetrieverTool(retriever, {
    name: "retrieve_blog_posts",
    description: "Search and return information about Deno from various blog posts.",
  },
);
export const tools = [tool];

const toolNode = new ToolNode<typeof GraphState.State>(tools);

export const workflow = new StateGraph(GraphState)
    .addNode("agent", agent)
    .addNode("retrieve", toolNode as any)
    .addNode("gradeDocuments", gradeDocuments)
    .addNode("rewrite", rewrite)
    .addNode("generate", generate);

    workflow.addEdge(START, "agent");

    // Decide whether to retrieve
    workflow.addConditionalEdges(
      "agent",
      // Assess agent decision
      shouldRetrieve,
    );
    
    workflow.addEdge("retrieve", "gradeDocuments");
    
    // Edges taken after the `action` node is called.
    workflow.addConditionalEdges(
      "gradeDocuments",
      // Assess agent decision
      checkRelevance,
      {
        // Call tool node
        yes: "generate",
        no: "rewrite", // placeholder
      },
    );
    
    workflow.addEdge("generate", END);
    workflow.addEdge("rewrite", "agent");
    
    // Compile
    export const app = workflow.compile();