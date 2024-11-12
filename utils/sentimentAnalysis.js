// Predefined keyword dictionaries with sentiment scores
const POSITIVE_KEYWORDS = new Map([
  ['excellent', 1.0],
  ['amazing', 1.0],
  ['great', 0.8],
  ['good', 0.5],
  ['nice', 0.5],
  ['decent', 0.3],
  ['friendly', 0.6],
  ['clean', 0.4],
  ['recommend', 0.7],
  ['delicious', 0.8],
  ['fantastic', 0.9],
  ['helpful', 0.6],
  ['professional', 0.7]
]);

const NEGATIVE_KEYWORDS = new Map([
  ['terrible', -1.0],
  ['horrible', -1.0],
  ['bad', -0.7],
  ['poor', -0.6],
  ['dirty', -0.6],
  ['rude', -0.8],
  ['slow', -0.4],
  ['expensive', -0.5],
  ['disappointing', -0.7],
  ['awful', -0.9],
  ['mediocre', -0.4],
  ['unprofessional', -0.7]
]);

/**
 * Analyzes the sentiment of a text review
 * @param {string} text - The review text to analyze
 * @returns {Object} Object containing sentiment score and analysis details
 */
function analyzeSentiment(text) {
  const words = text.toLowerCase().split(/\W+/);
  let totalScore = 0;
  let matchedWords = [];

  for (const word of words) {
    if (POSITIVE_KEYWORDS.has(word)) {
      totalScore += POSITIVE_KEYWORDS.get(word);
      matchedWords.push({ word, score: POSITIVE_KEYWORDS.get(word) });
    } else if (NEGATIVE_KEYWORDS.has(word)) {
      totalScore += NEGATIVE_KEYWORDS.get(word);
      matchedWords.push({ word, score: NEGATIVE_KEYWORDS.get(word) });
    }
  }

  // Normalize score to be between -1 and 1
  const normalizedScore = matchedWords.length > 0
    ? totalScore / Math.max(matchedWords.length, 1)
    : 0;

  return {
    score: parseFloat(normalizedScore.toFixed(2)),
    matchedWords,
    confidence: Math.min(matchedWords.length / 3, 1), // Simple confidence score based on matches
  };
}

/**
 * Analyzes sentiment for specific aspects of a review
 * @param {Object} review - Object containing aspect-specific review texts
 * @returns {Object} Sentiment scores for each aspect
 */
function analyzeAspectSentiment(review) {
  const aspects = {};
  
  for (const [aspect, text] of Object.entries(review)) {
    if (typeof text === 'string') {
      aspects[aspect] = analyzeSentiment(text);
    }
  }

  return aspects;
}

module.exports = {
  analyzeSentiment,
  analyzeAspectSentiment
}; 