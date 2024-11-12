const { analyzeSentiment } = require('./sentimentAnalysis');

// Aspect-related keyword mappings
const ASPECT_KEYWORDS = {
  service: [
    'service', 'staff', 'waiter', 'waitress', 'server', 'host',
    'hostess', 'employee', 'attention', 'responsive', 'quick',
    'slow', 'friendly', 'rude', 'helpful', 'attentive'
  ],
  food: [
    'food', 'dish', 'meal', 'taste', 'flavor', 'delicious',
    'portion', 'menu', 'cuisine', 'appetizer', 'entree',
    'dessert', 'drink', 'beverage', 'fresh', 'stale'
  ],
  pricing: [
    'price', 'value', 'expensive', 'cheap', 'affordable',
    'overpriced', 'cost', 'worth', 'deal', 'bargain',
    'pricey', 'reasonable', 'fair', 'money'
  ],
  ambiance: [
    'ambiance', 'atmosphere', 'decor', 'music', 'noise',
    'lighting', 'comfortable', 'clean', 'dirty', 'cozy',
    'crowded', 'quiet', 'romantic', 'space', 'interior'
  ],
  location: [
    'location', 'parking', 'accessible', 'neighborhood',
    'area', 'street', 'downtown', 'distance', 'convenient',
    'nearby', 'far', 'close'
  ]
};

/**
 * Categorizes text into aspects and analyzes sentiment for each
 * @param {string} reviewText - The full review text
 * @returns {Object} Sentiment analysis for each detected aspect
 */
function analyzeAspects(reviewText) {
  // Split review into sentences for better context
  const sentences = reviewText.toLowerCase()
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const aspectResults = {};

  // Initialize aspect containers
  for (const aspect of Object.keys(ASPECT_KEYWORDS)) {
    aspectResults[aspect] = {
      sentences: [],
      matchedKeywords: new Set(),
      sentimentScore: 0,
      mentionCount: 0
    };
  }

  // Categorize sentences by aspect
  for (const sentence of sentences) {
    const words = sentence.split(/\W+/);
    
    // Check each aspect for matching keywords in the sentence
    for (const [aspect, keywords] of Object.entries(ASPECT_KEYWORDS)) {
      const matches = keywords.filter(keyword => words.includes(keyword));
      
      if (matches.length > 0) {
        aspectResults[aspect].sentences.push(sentence);
        matches.forEach(match => aspectResults[aspect].matchedKeywords.add(match));
        aspectResults[aspect].mentionCount++;
      }
    }
  }

  // Analyze sentiment for each aspect
  const results = {};
  for (const [aspect, data] of Object.entries(aspectResults)) {
    if (data.sentences.length > 0) {
      const combinedText = data.sentences.join('. ');
      const sentimentAnalysis = analyzeSentiment(combinedText);
      
      results[aspect] = {
        score: sentimentAnalysis.score,
        confidence: sentimentAnalysis.confidence,
        mentions: data.mentionCount,
        keywords: Array.from(data.matchedKeywords),
        relevantText: data.sentences
      };
    }
  }

  return {
    aspects: results,
    summary: generateAspectSummary(results)
  };
}

/**
 * Generates a summary of the aspect analysis
 * @param {Object} aspectResults - The analyzed aspects
 * @returns {Object} Summary statistics
 */
function generateAspectSummary(aspectResults) {
  const aspects = Object.entries(aspectResults);
  if (aspects.length === 0) return null;

  const totalScore = aspects.reduce((sum, [_, data]) => sum + data.score, 0);
  const mentionedAspects = aspects.length;

  return {
    overallScore: parseFloat((totalScore / mentionedAspects).toFixed(2)),
    dominantAspects: aspects
      .sort((a, b) => b[1].mentions - a[1].mentions)
      .slice(0, 2)
      .map(([aspect, data]) => ({
        aspect,
        mentions: data.mentions,
        score: data.score
      }))
  };
}

module.exports = {
  analyzeAspects,
  ASPECT_KEYWORDS
}; 