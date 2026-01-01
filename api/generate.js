// api/generate.js
// Vercel Serverless Function - Proxy for Anthropic Claude API

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment variable
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { formData, nsfwMode, generationCount, isRegenerate } = req.body;

    if (!formData) {
      return res.status(400).json({ error: 'Missing form data' });
    }

    // Build the prompt
    const prompt = buildPrompt(formData, nsfwMode, generationCount, isRegenerate);

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `API error: ${response.status}`,
        details: errorText 
      });
    }

    const data = await response.json();

    // Extract text content
    const textContent = data.content?.find(item => item.type === 'text');
    if (!textContent?.text) {
      return res.status(500).json({ error: 'No text content in response' });
    }

    // Parse JSON from response
    let jsonStr = textContent.text.trim();
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    const parsed = JSON.parse(jsonStr);

    // Validate structure
    if (!parsed.benefit || !parsed.curiosity || !parsed.doubleEntendre) {
      return res.status(500).json({ error: 'Invalid response structure' });
    }

    return res.status(200).json({ success: true, titles: parsed });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function buildPrompt(fd, nsfwMode, generationCount, isRegenerate) {
  return `You are an expert book title strategist. Generate exactly 3 book titles based on the author's inputs below.

AUTHOR'S INPUTS:
- Ideal Reader: ${fd.idealReader}
- Reader's #1 Problem: ${fd.readerProblem}
- Transformation Promised: ${fd.transformation}
- Unique Methodology/Framework: ${fd.methodology || 'Not specified'}
- Enemy/Conventional Wisdom They Fight: ${fd.enemy}
- Surprising/Counterintuitive Truth: ${fd.surprisingTruth || 'Not specified'}
- Brand Personality: ${fd.brandPersonality}
- Existing Phrases That Resonate: ${fd.existingPhrases || 'None specified'}

PSYCHOLOGICAL FRAMEWORKS (generate exactly one title per framework):

1. BENEFIT/HOW-TO (Greed/Desire Psychology): 
Creates a title that answers a question the reader already has. When they see it, their brain thinks "You read my mind!" Example: "How to Win Friends and Influence People"

2. CURIOSITY (Curiosity-Driven Psychology):
Creates a question in the reader's mind. They think "What is that about?" Often uses intriguing single words or unexpected combinations. Examples: "Blink", "Outliers", "Atomic Habits"

3. DOUBLE ENTENDRE (Shock + Puzzle):
${nsfwMode 
  ? 'Creates a title with a provocative double meaning that initially shocks, then resolves into something relevant. Can be edgy, suggestive, or controversial. Examples: "50 Ways to Eat Cock" (chicken cookbook), "Cooking with Poo" (Thai chef named Poo)' 
  : 'Creates a title with a clever double meaning that intrigues, then resolves into something relevant. Keep it professional but clever—wordplay, industry terms with double meanings, or unexpected combinations.'}

TITLE FORMAT OPTIONS:
- Short punchy title (1-3 words) with explanatory subtitle
- Or full phrase title that stands alone
- Subtitles can ask or answer a question
- Match the brand personality: ${fd.brandPersonality}

${isRegenerate ? `CRITICAL: This is regeneration attempt #${generationCount}. You MUST generate COMPLETELY DIFFERENT titles than any previous attempts. Take a fresh creative angle, use different word choices, and explore new directions.` : ''}

You must respond with ONLY valid JSON in this exact format (no markdown, no explanation, just JSON):
{"benefit":{"title":"Title Here","subtitle":"Subtitle or empty string","reasoning":"2-3 sentences why this works"},"curiosity":{"title":"Title Here","subtitle":"Subtitle or empty string","reasoning":"2-3 sentences why this works"},"doubleEntendre":{"title":"Title Here","subtitle":"Subtitle or empty string","reasoning":"2-3 sentences why this works"}}`;
}
