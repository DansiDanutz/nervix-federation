/**
 * Image generation helper
 *
 * Currently a placeholder — image generation requires an external AI service.
 * The storagePut function is ready for when a provider is configured.
 */
import { storagePut } from "../storage";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  _options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // TODO: Integrate with an image generation API (e.g., OpenAI DALL-E, Stability AI)
  // When ready, generate the image, then store it via storagePut:
  //
  //   const buffer = Buffer.from(base64Data, "base64");
  //   const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, "image/png");
  //   return { url };

  throw new Error("Image generation service not configured. Set up an AI image provider first.");
}
