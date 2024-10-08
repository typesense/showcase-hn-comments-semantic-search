import jQuery from "jquery";
window.$ = jQuery; // workaround for https://github.com/parcel-bundler/parcel/issues/333
import "bootstrap";
import { debounce } from "instantsearch.js/es/lib/utils";
import instantsearch from "instantsearch.js/es";
import {
  searchBox,
  infiniteHits,
  refinementList,
  stats,
  configure,
} from "instantsearch.js/es/widgets";
import { history } from "instantsearch.js/es/lib/routers";
import TypesenseInstantSearchAdapter from "typesense-instantsearch-adapter";
import { SearchClient as TypesenseSearchClient } from "typesense"; // To get the total number of docs

let TYPESENSE_SERVER_CONFIG = {
  apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY,
  nodes: [
    {
      host: process.env.TYPESENSE_HOST,
      port: process.env.TYPESENSE_PORT,
      protocol: process.env.TYPESENSE_PROTOCOL,
    },
  ],
  numRetries: 8,
};

if (process.env[`TYPESENSE_HOST_2`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: process.env[`TYPESENSE_HOST_2`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_3`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: process.env[`TYPESENSE_HOST_3`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_NEAREST`]) {
  TYPESENSE_SERVER_CONFIG["nearestNode"] = {
    host: process.env[`TYPESENSE_HOST_NEAREST`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  };
}

const INDEX_NAME = process.env.TYPESENSE_COLLECTION_NAME;

async function getIndexSize() {
  let typesenseSearchClient = new TypesenseSearchClient(
    TYPESENSE_SERVER_CONFIG,
  );
  let results = await typesenseSearchClient
    .collections(INDEX_NAME)
    .documents()
    .search({ q: "*" });

  return results["found"];
}

let indexSize;
(async () => {
  indexSize = await getIndexSize();
})();

let search;

function googleAnalyticsMiddleware() {
  const sendEventDebounced = debounce(() => {
    gtag("event", "page_view", {
      page_location: window.location.pathname + window.location.search,
    });
  }, 3000);

  return {
    onStateChange() {
      sendEventDebounced();
    },
    subscribe() {},
    unsubscribe() {},
  };
}

function renderSearch(searchType) {
  if (search) {
    search.dispose();
  }

  const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
    server: TYPESENSE_SERVER_CONFIG,
    // The following parameters are directly passed to Typesense's search API endpoint.
    //  So you can pass any parameters supported by the search endpoint below.
    //  queryBy is required.
    additionalSearchParameters: {
      query_by:
        searchType === "keyword"
          ? "text"
          : searchType === "semantic"
          ? "embedding"
          : "text,embedding",
      exclude_fields: "embedding",
      vector_query: searchType === "keyword" ? null : "embedding:([], k:200)",
    },
  });
  const searchClient = typesenseInstantsearchAdapter.searchClient;

  search = instantsearch({
    searchClient,
    indexName: INDEX_NAME,
    routing: {
      router: history({
        cleanUrlOnDispose: false,
      }),
    },
    future: {
      preserveSharedStateOnUnmount: true,
    },
    onStateChange({ uiState, setUiState }) {
      const { "hn-comments": state } = uiState;
      const query = state.query || "";
      const page = state.page || 0;
      const searchType = $("#search-type-select").val();

      const configure = {
        ...state.configure,
        typesenseVectorQuery:
          query && ["semantic", "hybrid"].includes(searchType)
            ? `embedding:([], k:200)`
            : null,
      };

      const newUiState = {
        ...uiState,
        "hn-comments": {
          ...state,
          configure,
          page,
        },
      };

      setUiState(newUiState);
    },
  });

  search.addWidgets([
    searchBox({
      container: "#searchbox",
      showSubmit: false,
      showReset: false,
      placeholder:
        "Type in a search term, or click on one of the examples below",
      autofocus: true,
      cssClasses: {
        input: "form-control",
      },
    }),

    stats({
      container: "#stats",
      cssClasses: {
        text: "text-muted small",
        root: "text-end",
      },
      templates: {
        item(hit, { html, components }) {
          return html`
            <div class="result-container mb-4">
              <div class="text-muted small">
                <span class="text-primary">${hit.by}</span>|
                ${new Date(hit.time * 1000).toLocaleString()}|
                <a
                  class="text-decoration-none"
                  href="https://news.ycombinator.com/item?id=${hit.id}"
                  target="_blank"
                >
                  link</a
                >|
                <a
                  class="text-decoration-none"
                  href="https://news.ycombinator.com/item?id=${hit.parent}"
                  target="_blank"
                >
                  parent
                </a>
              </div>
              <div class="mt-1">
                ${components.Highlight({ hit, attribute: "text" })}
              </div>
            </div>
          `;
        },
        empty(results, { html }) {
          if (results.query === "") return null;

          return html`No results found for "${results.query}"`;
        },
      },
    }),
    infiniteHits({
      container: "#hits",
      cssClasses: {
        list: "list-unstyled grid-container",
        item: "d-flex flex-column search-result-card bg-light-2",
        loadMore: "btn btn-primary mx-auto d-block mt-4",
      },
      templates: {
        item(hit, { html, components }) {
          return html`
            <div class="result-container mb-4">
              <div class="text-muted small">
                <span class="text-primary me-2">${hit.by}</span>|
                <span class="mx-1"
                  >${new Date(hit.time * 1000).toLocaleString()}</span
                >|
                <a
                  class="text-decoration-none mx-1"
                  href="https://news.ycombinator.com/item?id=${hit.id}"
                  target="_blank"
                >
                  link</a
                >|
                <a
                  class="text-decoration-none mx-1"
                  href="https://news.ycombinator.com/item?id=${hit.parent}"
                  target="_blank"
                >
                  parent
                </a>
              </div>
              <div class="mt-1">
                ${components.Highlight({ hit, attribute: "text" })}
              </div>
            </div>
          `;
        },
        empty(results, { html }) {
          if (results.query === "") return null;

          return html`No results found for "${results.query}"`;
        },
      },
      transformItems: (items) => {
        return items.map((item) => {
          return {
            ...item,
            display_timestamp: (() => {
              const parsedDate = new Date(item.time * 1000);
              return `${parsedDate.toLocaleString()}`;
            })(),
          };
        });
      },
    }),
    refinementList({
      container: "#users-refinement-list",
      attribute: "by",
      searchable: true,
      searchablePlaceholder: "Search users",
      showMore: true,
      cssClasses: {
        searchableInput: "form-control form-control-sm mb-2 border-light-2",
        searchableSubmit: "d-none",
        searchableReset: "d-none",
        showMore: "btn btn-primary btn-sm",
        list: "list-unstyled",
        count: "badge rounded-pill text-bg-light fw-normal text-muted ms-2",
        label: "d-flex align-items-center",
        checkbox: "me-2",
      },
    }),
    configure({
      hitsPerPage: 15,
    }),
  ]);

  search.on("render", function () {
    // Make artist names clickable
    $("#hits .clickable-search-term").on("click", handleSearchTermClick);
    document.querySelectorAll(".ais-Highlight").forEach((element) => {
      element.innerHTML = decodeHtml(element.innerHTML);
    });
  });

  search.use(googleAnalyticsMiddleware);
  search.start();
}

function handleSearchTermClick(event) {
  const $searchBox = $("#searchbox input[type=search]");
  search.helper.clearRefinements();
  $searchBox.val(event.currentTarget.textContent);
  search.helper.setQuery($searchBox.val()).search();
}

// Source: https://stackoverflow.com/a/42182294/123545
function decodeHtml(html) {
  var txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

$(function () {
  const $searchBox = $("#searchbox input[type=search]");

  renderSearch($("#search-type-select").val());

  // Handle example search terms
  $(".clickable-search-term").on("click", handleSearchTermClick);
  $("#search-type-select").on("change", function () {
    const searchType = this.value;
    renderSearch(searchType);
  });

  // Clear refinements, when searching
  $searchBox.on("keydown", (event) => {
    search.helper.clearRefinements();
  });

  if (!matchMedia("(min-width: 768px)").matches) {
    $searchBox.on("focus, keydown", () => {
      $("html, body").animate(
        {
          scrollTop: $("#searchbox-container").offset().top,
        },
        500,
      );
    });
  }
});
