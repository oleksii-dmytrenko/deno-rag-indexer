import { OllamaEmbeddings } from "npm:@langchain/ollama";
import { RecursiveCharacterTextSplitter } from "npm:@langchain/textsplitters";
import { MemoryVectorStore } from "npm:langchain/vectorstores/memory";
import { CheerioWebBaseLoader } from "npm:@langchain/community/document_loaders/web/cheerio";


export async function getRetriever()  {
  const urls = [
    "https://deno.com/blog/not-using-npm-specifiers-doing-it-wrong",
    "https://deno.com/blog/v2.1",
    "https://deno.com/blog/build-database-app-drizzle",
  ];

  const embeddings = new OllamaEmbeddings({
    model: "mxbai-embed-large",
  });
  
  const docs = await Promise.all(
    urls.map((url) => new CheerioWebBaseLoader(url).load()),
  );
  const docsList = docs.flat();
  
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  const allSplits = await splitter.splitDocuments(docsList);
  console.log(`Split blog posts into ${allSplits.length} sub-documents.`);
  
  
  const vectorStore = await MemoryVectorStore.fromDocuments(
    allSplits,
    embeddings,
  );
  
  return vectorStore.asRetriever();
}


