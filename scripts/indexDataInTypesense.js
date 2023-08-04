require("dotenv").config();

const fs = require("fs");
const readline = require("readline");
const Typesense = require("typesense");

const client = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST,
      port: process.env.TYPESENSE_PORT,
      protocol: process.env.TYPESENSE_PROTOCOL,
    },
  ],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY,
  retryIntervalSeconds: 5,
  connectionTimeoutSeconds: 60 * 60,
});

const indexName = process.env.TYPESENSE_COLLECTION_NAME;
const batchSize = 10000;

async function indexJSONL() {
  const schema = {
    name: indexName,
    fields: [
      { name: "by", type: "string", facet: true },
      { name: "time", type: "int64" },
      { name: "text", type: "string" },
      { name: "parent", type: "string", optional: true },
      {
        name: "embedding",
        type: "float[]",
        // The following is Typesense's built-in embedding generation feature, supported starting from 0.25.0.rc60
        embed: {
          // The field names in our JSON documents that need to be used for embedding generation
          from: ["text"],
          /**
           * 1. Using built-in Embedding Models
           * We're using the Sentence-BERT model below,
           *  but you can also choose to use any of the built-in models here: https://huggingface.co/typesense/models/tree/main
           */
          model_config: {
            model_name: "ts/all-MiniLM-L12-v2",
          },
          /**
           * 2. Using Remote Embedding Models:
           */
          /*** OpenAI */
          // model_config: {
          //   model_name: "openai/text-embedding-ada-002",
          //   api_key: "your_openai_api_key",
          // },
          /*** Google's PaLM API */
          // model_config: {
          //   model_name: "google/embedding-gecko-001",
          //   api_key: "your_palm_api_key_from_makersuite.google.com",
          // },
          /*** GCP Vertex API */
          // model_config: {
          //   model_name: "gcp/embedding-gecko-001",
          //   access_token: "your_gcp_access_token",
          //   refresh_token: "your_gcp_refresh_token",
          //   client_id: "your_gcp_app_client_id",
          //   client_secret: "your_gcp_client_secret",
          //   project_id: "your_gcp_project_id",
          // },
        },
      },
    ],
    default_sorting_field: "time",
  };
  try {
    await client.collections(indexName).delete();
  } catch (e) {
    // Do nothing if the collection doesn't exist
  }
  await client.collections().create(schema);

  // read the JSONL file and parse it into batches
  // const jsonlFilePath = "data/hn-comments-oct-2022.jsonl";
  const jsonlFilePath = "data/hn-comments-1000-sample.jsonl";
  const jsonlReadStream = fs.createReadStream(jsonlFilePath, {
    encoding: "utf8",
  });
  const jsonlReader = readline.createInterface({ input: jsonlReadStream });
  let currentBatchJSONLString = "";
  let currentBatchNumDocs = 0;
  let batchCount = 0;

  for await (const line of jsonlReader) {
    currentBatchJSONLString = currentBatchJSONLString + "\n" + line;
    currentBatchNumDocs += 1;
    if (currentBatchNumDocs === batchSize) {
      await indexBatch(currentBatchJSONLString, batchCount++);
      currentBatchJSONLString = ""; // reset the batch
      currentBatchNumDocs = 0;
    }
  }

  if (currentBatchNumDocs > 0) {
    await indexBatch(currentBatchJSONLString, batchCount);
  }

  // index a batch of documents
  async function indexBatch(docs, batchNum) {
    console.log(`Indexing batch ${batchNum}...`);
    const resultsInJSONLFormat = await client
      .collections(indexName)
      .documents()
      .import(docs, { dirty_values: "coerce_or_reject" });

    const resultsInJSONFormat = resultsInJSONLFormat
      .split("\n")
      .map((r) => JSON.parse(r));
    const failedItems = resultsInJSONFormat.filter((r) => r.success === false);
    if (failedItems.length > 0) {
      console.warn(failedItems);
    }
  }
}

indexJSONL().catch(console.error);
