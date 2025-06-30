import { Clipboard, Toast, showToast, captureException, getPreferenceValues } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import OpenAI from "openai";
import { z } from "zod";
import { readFileSync, unlinkSync } from "fs";

interface Preferences {
  openaiApiKey: string;
  model: string;
}

// スクリーンショット撮影のAppleScript
const captureScript = `
  set screenshotPath to (path to desktop folder as string) & "raycast_ocr_temp.png"
  do shell script "screencapture -i " & quoted form of POSIX path of screenshotPath
  return POSIX path of screenshotPath
`;

// OCR結果のスキーマ定義
const ocrResultSchema = z.object({
  text: z.string().describe("Extract all text content from the image"),
  confidence: z.number().min(0).max(1).describe("Confidence level of the extracted text"),
  language: z.string().describe("Detected language of the text"),
});

// 画像をbase64エンコード
function encodeImageToBase64(imagePath: string): string {
  try {
    const imageBuffer = readFileSync(imagePath);
    return imageBuffer.toString("base64");
  } catch (error) {
    throw new Error(`Failed to encode image: ${error}`);
  }
}

// OCR処理を実行
async function performOCR(imagePath: string, apiKey: string, model: string = "gpt-4o") {
  try {
    console.log("Starting OCR with model:", model, "API key length:", apiKey.length);

    const base64Image = encodeImageToBase64(imagePath);
    console.log("Image encoded, base64 length:", base64Image.length);

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: '画像内のすべてのテキストを正確に抽出してください。テキストの配置や構造を可能な限り保持し、日本語、英語、その他の言語を適切に認識してください。結果は必ずJSON形式で返してください: {"text": "抽出したテキスト", "confidence": 0.95, "language": "日本語"}',
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI APIから応答を取得できませんでした");
    }

    console.log("Raw OpenAI response:", content);

    // JSONレスポンスをパース
    try {
      const jsonMatch = content.match(/\{.*\}/s);
      if (!jsonMatch) {
        // JSONが見つからない場合は、テキストをそのまま使用
        return {
          text: content,
          confidence: 0.9,
          language: "不明",
        };
      }

      const parsedResult = JSON.parse(jsonMatch[0]);
      const validatedResult = ocrResultSchema.parse(parsedResult);

      console.log("OCR completed successfully");
      return validatedResult;
    } catch (parseError) {
      console.warn("JSON parsing failed, using raw text:", parseError);
      return {
        text: content,
        confidence: 0.8,
        language: "不明",
      };
    }
  } catch (error) {
    console.error("OCR processing error details:", error);
    throw new Error(`OCR処理に失敗しました: ${error}`);
  }
}

// クリーンアップ用の関数
function cleanupTempFile(filePath: string) {
  try {
    unlinkSync(filePath);
  } catch (error) {
    console.warn(`Temporary file cleanup failed: ${error}`);
  }
}

export default async function main() {
  const preferences = getPreferenceValues<Preferences>();

  console.log("Preferences loaded:", {
    hasApiKey: !!preferences.openaiApiKey,
    keyLength: preferences.openaiApiKey?.length || 0,
    model: preferences.model,
  });

  if (!preferences.openaiApiKey || preferences.openaiApiKey.trim() === "") {
    await showToast({
      style: Toast.Style.Failure,
      title: "エラー",
      message: "OpenAI APIキーが設定されていません。エクステンション設定で設定してください。",
    });
    return;
  }

  let tempImagePath: string | null = null;

  try {
    // ローディングトーストを表示
    const loadingToast = await showToast({
      style: Toast.Style.Animated,
      title: "スクリーンショットを撮影中...",
    });

    // スクリーンショット撮影
    const result = await runAppleScript(captureScript);
    tempImagePath = result.trim();

    if (!tempImagePath) {
      throw new Error("スクリーンショットの撮影がキャンセルされました");
    }

    console.log("Screenshot captured at:", tempImagePath);

    // OCR処理中のトーストに更新
    loadingToast.title = "AI OCR処理中...";

    // OCR処理実行
    const ocrResult = await performOCR(tempImagePath, preferences.openaiApiKey.trim(), preferences.model || "gpt-4o");

    if (!ocrResult.text || ocrResult.text.trim().length === 0) {
      throw new Error("画像からテキストを抽出できませんでした");
    }

    // クリップボードにコピー
    await Clipboard.copy(ocrResult.text);

    // 成功トーストを表示
    await showToast({
      style: Toast.Style.Success,
      title: "OCR完了",
      message: `テキストをクリップボードにコピーしました（信頼度: ${Math.round(ocrResult.confidence * 100)}%）`,
    });
  } catch (error) {
    console.error("OCR処理エラー:", error);

    await showToast({
      style: Toast.Style.Failure,
      title: "OCR処理に失敗しました",
      message: error instanceof Error ? error.message : "不明なエラーが発生しました",
    });

    captureException(error);
  } finally {
    // 一時ファイルをクリーンアップ
    if (tempImagePath) {
      cleanupTempFile(tempImagePath);
    }
  }
}
