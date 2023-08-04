# 🗞 Semantic + Keyword + Hybrid Search with HN Comments

This is a demo that showcases [Typesense's](https://github.com/typesense/typesense) vector search features using a collection of 300K HN Comments.

View it live here: [hn-comments-search.typesense.org](https://hn-comments-search.typesense.org)

## Tech Stack

This search experience is powered by <a href="https://typesense.org" target="_blank">Typesense</a> which is
a blazing-fast, <a href="https://github.com/typesense/typesense" target="_blank">open source</a> typo-tolerant
search-engine. It is an open source alternative to Algolia and an easier-to-use alternative to ElasticSearch.

This demo uses a geo-distributed 3-node Typesense cluster running on <a href="https://cloud.typesense.org" target="_blank">Typesense Cloud</a>,
with nodes in Oregon, Frankfurt and Mumbai.

## Repo structure

- `src/` and `index.html` - contain the frontend UI components, built with <a href="https://github.com/typesense/typesense-instantsearch-adapter" target="_blank">Typesense Adapter for InstantSearch.js</a>
- `scripts/` - contains the script to index the data into Typesense.
- `data/` - contains a 1K sample subset of the HN comments dataset. But you can download the full dataset from the [Google BigQuery marketplace](https://console.cloud.google.com/marketplace/product/y-combinator/hacker-news).

## Development

To run this project locally, install the dependencies and run the local server:

```sh
yarn
yarn run typesenseServer
ln -s .env.sample .env
yarn run indexer
yarn start
```

Open http://localhost:3001 to see the app.

## Deployment

The app is hosted on [Cloudflare Pages](https://pages.cloudflare.com).

Pushing to master will deploy the app to production.
