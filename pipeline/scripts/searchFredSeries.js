import { getConfiguredEmbeddingModel } from '../src/clients/embedding.js';
import { withDatabaseClient } from '../src/clients/database.js';
import { searchFredSeries } from '../src/services/fredSeriesSearch.js';

function parseSearchArgs() {
  const args = process.argv.slice(2);
  let limit = 10;
  let sawLimitOption = false;
  const queryParts = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--limit') {
      const value = Number.parseInt(args[index + 1], 10);

      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--limit must be a positive integer.');
      }

      limit = value;
      sawLimitOption = true;
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      throw new Error('Use "--limit 5" instead of "--limit=5".');
    } else if (arg.startsWith('-')) {
      throw new Error(`Unsupported option "${arg}". Only "--limit 5" is supported.`);
    } else {
      queryParts.push(arg);
    }
  }

  const query = queryParts.join(' ').trim();

  if (!sawLimitOption && queryParts.length > 1 && /^\d+$/.test(queryParts[0])) {
    throw new Error(
      `Did you mean "--limit ${queryParts[0]}"? Example: npm.cmd run db:search:fred -- --limit ${queryParts[0]} "${queryParts
        .slice(1)
        .join(' ')}"`,
    );
  }

  if (!query) {
    throw new Error(
      'Search query is required. Example: npm.cmd run db:search:fred -- "inflation and unemployment"',
    );
  }

  return { query, limit };
}

const { query, limit } = parseSearchArgs();

function formatDate(value) {
  if (!value) {
    return 'n/a';
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

console.log(`Embedding model: ${getConfiguredEmbeddingModel()}`);
console.log(`Search query: ${query}`);
console.log(`Result limit: ${limit.toLocaleString()}`);

await withDatabaseClient(async (client) => {
  const results = await searchFredSeries(client, query, { limit });

  if (results.length === 0) {
    console.log('No embedded FRED series found. Run db:embed:fred first.');
    return;
  }

  for (const [index, result] of results.entries()) {
    const rank = index + 1;
    const scopes = result.scopes?.join(', ') || 'unknown';
    const similarity = Number(result.similarity).toFixed(4);

    console.log(
      `${rank}. ${result.series_id} | similarity ${similarity} | popularity ${result.popularity ?? 'n/a'}`,
    );
    console.log(`   ${result.title}`);
    console.log(
      `   ${result.units ?? 'n/a'} | ${result.frequency ?? 'n/a'} | ${result.seasonal_adjustment ?? 'n/a'} | ${scopes}`,
    );
    console.log(
      `   Observations: ${formatDate(result.observation_start)} to ${formatDate(result.observation_end)}`,
    );
  }
});
