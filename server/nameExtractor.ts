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
  if (!ai) {
    console.warn('[NameExtractor] GEMINI_API_KEY is not set in environment.');
    return null;
  }

  try {
    const base64 = frontBuffer.toString('base64');

    // Timeout after 8 seconds so bot remains fast while allowing OCR to complete
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));

    const extractionPromise = (async () => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64
                }
              },
              {
                text: 'Extract ONLY the English Full Name from this Ethiopian ID card (e.g. First Name, Father Name, Grandfather Name under "Full Name" or "Full Name / ሙሉ ስም"). Return ONLY the English name words separated by spaces, with no labels, numbers, extra punctuation or markdown.'
              }
            ]
          }
        });

        const rawText = response.text?.trim();
        if (!rawText) return null;

        // Clean and sanitize name
        // e.g., "Full Name: Seyid Ahmed Chane" -> "Seyid_Ahmed_Chane"
        const cleaned = rawText
          .replace(/^(name|full name|english name|ሙሉ ስም):/i, '')
          .replace(/[^a-zA-Z\s]/g, '')
          .trim();

        const words = cleaned.split(/\s+/).filter(w => w.length > 1 && !/^(full|name|ethiopia|id|card|republic|federal|fayda|kebele|sex|dob)$/i.test(w));
        if (words.length > 0) {
          // Capitalize each word nicely
          const formattedWords = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          return formattedWords.join('_');
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
