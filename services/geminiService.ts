import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Ekstraksi data pengiriman dari gambar label atau paket
 */
export const extractShippingData = async (base64Image: string) => {
  try {
    // Fix: Using correct multi-part content structure as per @google/genai guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } },
          { text: "Extract shipping information from this image. Return as JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            toName: { type: Type.STRING },
            toPhone: { type: Type.STRING },
            toAddress: { type: Type.STRING },
            fromName: { type: Type.STRING },
            courier: { type: Type.STRING },
            note: { type: Type.STRING }
          },
          required: ["toName", "toAddress"]
        }
      }
    });

    // Fix: Access response.text as a property, not a method
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Extraction Error:", error);
    throw error;
  }
};

/**
 * Ekstraksi daftar belanja dari foto struk/nota manual
 */
export const extractReceiptData = async (base64Image: string) => {
  try {
    // Fix: Using correct multi-part content structure as per @google/genai guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } },
          { text: "List all items, prices, and quantities from this receipt. Return as JSON array." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.NUMBER },
              qty: { type: Type.NUMBER }
            },
            required: ["name", "price", "qty"]
          }
        }
      }
    });

    // Fix: Access response.text as a property, not a method
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Receipt Extraction Error:", error);
    throw error;
  }
};