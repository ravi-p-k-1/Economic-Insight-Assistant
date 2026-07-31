import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { getConfiguredEmbeddingModel } from '../src/clients/embedding.js';
import { withDatabaseClient } from '../src/clients/database.js';
import { searchFredSeries } from '../src/services/fredSeriesSearch.js';

const defaultQuestionsPath = 'evaluation/questions.json';
const defaultLimit = 5;

function parsePositiveIntegerOption(name, fallback) {
  const optionIndex = process.argv.indexOf(name);

  if (optionIndex === -1) {
    return fallback;
  }

  const value = Number.parseInt(process.argv[optionIndex + 1], 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function parseStringOption(name, fallback) {
  const optionIndex = process.argv.indexOf(name);

  if (optionIndex === -1) {
    return fallback;
  }

  const value = process.argv[optionIndex + 1];

  if (!value) {
    throw new Error(`${name} requires a value.`);
  }

  return value;
}

function validateQuestions(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Evaluation questions must be a non-empty array.');
  }

  return value.map((item, index) => {
    if (typeof item.question !== 'string' || item.question.trim() === '') {
      throw new Error(`Question ${index + 1} is missing a question string.`);
    }

    if (!Array.isArray(item.relevantSeries) || item.relevantSeries.length === 0) {
      throw new Error(`Question ${index + 1} is missing relevantSeries.`);
    }

    return {
      question: item.question.trim(),
      relevantSeries: item.relevantSeries.map((seriesId) => String(seriesId).toUpperCase()),
    };
  });
}

async function loadQuestions(path) {
  const text = await readFile(path, 'utf8');
  return validateQuestions(JSON.parse(text));
}

async function countValidSeries(client, seriesIds) {
  if (seriesIds.length === 0) {
    return 0;
  }

  const { rows } = await client.query(
    `
      SELECT count(*)::int AS valid_count
      FROM fred_series
      WHERE series_id = ANY($1)
    `,
    [seriesIds],
  );

  return rows[0]?.valid_count ?? 0;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

const limit = parsePositiveIntegerOption('--limit', defaultLimit);
const questionsPath = parseStringOption('--questions', defaultQuestionsPath);
const questions = await loadQuestions(questionsPath);

console.log(`Embedding model: ${getConfiguredEmbeddingModel()}`);
console.log(`Evaluation questions: ${questions.length.toLocaleString()}`);
console.log(`Retrieval limit: ${limit.toLocaleString()}`);
console.log(`Questions file: ${questionsPath}`);

try {
  await withDatabaseClient(async (client) => {
    let recallSum = 0;
    let validSeriesCount = 0;
    let retrievedSeriesCount = 0;
    let responseTimeSumMs = 0;

    for (const [index, item] of questions.entries()) {
      const startedAt = performance.now();
      const results = await searchFredSeries(client, item.question, { limit });
      const responseTimeMs = performance.now() - startedAt;
      const retrievedIds = results.map((result) => result.series_id.toUpperCase());
      const relevantSet = new Set(item.relevantSeries);
      const matchedIds = retrievedIds.filter((seriesId) => relevantSet.has(seriesId));
      const recall = matchedIds.length / relevantSet.size;
      const validCount = await countValidSeries(client, retrievedIds);

      recallSum += recall;
      validSeriesCount += validCount;
      retrievedSeriesCount += retrievedIds.length;
      responseTimeSumMs += responseTimeMs;

      console.log('');
      console.log(`${index + 1}. ${item.question}`);
      console.log(`   Retrieved: ${retrievedIds.join(', ') || 'none'}`);
      console.log(`   Relevant: ${item.relevantSeries.join(', ')}`);
      console.log(`   Matches: ${matchedIds.join(', ') || 'none'}`);
      console.log(`   Recall@${limit}: ${formatPercent(recall)} | Time: ${responseTimeMs.toFixed(0)}ms`);
    }

    const averageRecall = recallSum / questions.length;
    const validSeriesRate = retrievedSeriesCount > 0
      ? validSeriesCount / retrievedSeriesCount
      : 0;
    const averageResponseTimeMs = responseTimeSumMs / questions.length;

    console.log('');
    console.log('Retrieval Evaluation Summary');
    console.log(`Recall@${limit}: ${formatPercent(averageRecall)}`);
    console.log(`Valid FRED-series rate: ${formatPercent(validSeriesRate)}`);
    console.log(`Average response time: ${averageResponseTimeMs.toFixed(0)}ms`);
    console.log(`Questions evaluated: ${questions.length.toLocaleString()}`);
  });
} catch (error) {
  console.error('');
  console.error('Unable to run retrieval evaluation.');
  console.error('Make sure Docker Desktop is running and start the pipeline database with:');
  console.error('docker compose up -d');
  console.error(`Details: ${error.message}`);
  process.exitCode = 1;
}
