import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

/**
 * Extracts the person's English full name (First, Father, Grandfather) from an Ethiopian ID card.
 */
export async function extractNameFromCard(frontBuffer: Buffer): Promise<string | null> {
  const ai = getAiClient();
  if (!ai) return null;

  try {
    const base64 = frontBuffer.toString('base64');

    // Timeout after 3 seconds so bot remains lightning fast
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

    const extractionPromise = (async () => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64
                }
              },
              {
                text: 'Extract ONLY the English Full Name from this Ethiopian ID card (e.g. First Name, Father Name, Grandfather Name under "Full Name"). Return ONLY the English name in plain text, with no extra punctuation or explanations.'
              }
            ]
          }
        });

        const rawText = response.text?.trim();
        if (!rawText) return null;

        // Clean and sanitize name
        // e.g., "Seyid Ahmed Chane" -> "Seyid_Ahmed_Chane"
        const cleaned = rawText
          .replace(/^(name|full name|english name):/i, '')
          .replace(/[^a-zA-Z\s_-]/g, '')
          .trim();

        const words = cleaned.split(/\s+/).filter(w => w.length > 1);
        if (words.length > 0) {
          return words.join('_');
        }
        return null;
      } catch (err: any) {
        console.warn('[NameExtractor] Error calling Gemini:', err.message);
        return null;
      }
    })();

    return await Promise.race([extractionPromise, timeoutPromise]);
  } catch (e) {
    console.error('[NameExtractor] Exception:', e);
    return null;
  }
}
