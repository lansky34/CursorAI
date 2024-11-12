const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generates a comparative analysis between two businesses using OpenAI
 * @param {Object} business1 - First business data with reviews and metrics
 * @param {Object} business2 - Second business data with reviews and metrics
 * @returns {Promise<Object>} Comparative analysis
 */
async function generateComparison(business1, business2) {
  try {
    const prompt = `
      Compare these two businesses:

      Business 1: ${business1.name}
      - Overall Sentiment: ${business1.sentimentScore}
      - Aspect Scores: ${JSON.stringify(business1.aspectSentiment)}
      - Visit Count: ${business1.visitCount}
      
      Business 2: ${business2.name}
      - Overall Sentiment: ${business2.sentimentScore}
      - Aspect Scores: ${JSON.stringify(business2.aspectSentiment)}
      - Visit Count: ${business2.visitCount}

      Please provide a detailed comparison focusing on:
      1. Key strengths and weaknesses of each business
      2. Notable differences in customer sentiment across aspects
      3. Competitive advantages and areas for improvement
      4. Market positioning based on the data

      Format the response as JSON with the following structure:
      {
        "comparison": {
          "keyDifferences": [],
          "similarities": [],
          "recommendations": {
            "business1": [],
            "business2": []
          }
        }
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4",
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(completion.choices[0].message.content);

    return {
      ...analysis,
      metadata: {
        generatedAt: new Date(),
        model: "gpt-4",
        businesses: [business1.name, business2.name]
      }
    };

  } catch (error) {
    console.error('Error generating comparison:', error);
    throw new Error('Failed to generate business comparison');
  }
}

/**
 * Generates improvement suggestions for a single business
 * @param {Object} business - Business data including reviews and metrics
 * @returns {Promise<Object>} Detailed suggestions for improvement
 */
async function generateImprovementSuggestions(business) {
  try {
    const prompt = `
      Analyze this business and provide improvement suggestions:

      Business: ${business.name}
      Metrics:
      - Overall Sentiment: ${business.sentimentScore}
      - Aspect Scores: ${JSON.stringify(business.aspectSentiment)}
      - Visit Count: ${business.visitCount}
      - Badges: ${business.badges.join(', ')}

      Please provide actionable suggestions focusing on:
      1. Areas with lowest sentiment scores
      2. Opportunities for growth
      3. Customer experience improvements
      4. Competitive positioning

      Format as JSON with specific, actionable recommendations.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4",
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content);

  } catch (error) {
    console.error('Error generating suggestions:', error);
    throw new Error('Failed to generate improvement suggestions');
  }
}

module.exports = {
  generateComparison,
  generateImprovementSuggestions
}; 