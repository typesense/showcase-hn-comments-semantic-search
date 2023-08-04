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
        embed: {
          from: ["text"],
          model_config: {
            model_name: "ts/all-MiniLM-L12-v2",
          },
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
  const jsonlFilePath = "data/hn-comments-oct-2022.jsonl";
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
