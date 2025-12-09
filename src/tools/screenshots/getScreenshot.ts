import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import type { Tool, ToolContext, ToolOutput } from "../tool";
import { requestImages, type ImageData } from "../../server/server";

export interface GetScreenshotInput {
  index: number;
}

/**
 * Creates a dynamic screenshot tool based on available images for a request.
 * Returns null if no images are available.
 */
export function createScreenshotTool(requestId: string | null): Tool | null {
  if (!requestId) {
    return null;
  }

  const images = requestImages.get(requestId);
  if (!images || images.length === 0) {
    return null;
  }

  // Build description with available screenshots
  const screenshotDescriptions = images.map((img, i) => {
    const desc = img.description || `Screenshot ${i + 1}`;
    return `  - Index ${i}: ${desc} (${img.type})`;
  }).join('\n');

  return {
    definition: {
      name: "get_screenshot",
      description: `Retrieve a screenshot image attached to this request. Use this tool when you need to visually analyze a screenshot to understand UI elements, layout, errors, or other visual information.

Available screenshots:
${screenshotDescriptions}

Call this tool with the index of the screenshot you want to view. The image will be returned for visual analysis.`,
      inputSchema: {
        type: "object" as const,
        properties: {
          index: {
            type: "number",
            description: `The index of the screenshot to retrieve (0 to ${images.length - 1})`,
          },
        },
        required: ["index"],
      },
    },
    execute: async (input: GetScreenshotInput, ctx: ToolContext): Promise<ToolOutput> => {
      const { index } = input;
      
      // Re-fetch images in case they changed
      const currentImages = requestImages.get(requestId);
      if (!currentImages || currentImages.length === 0) {
        return { text: "No screenshots available for this request." };
      }

      if (index < 0 || index >= currentImages.length) {
        return { 
          text: `Invalid screenshot index. Please use an index between 0 and ${currentImages.length - 1}.` 
        };
      }

      const img = currentImages[index];
      const description = img.description || `Screenshot ${index + 1}`;

      ctx.outputChannel.appendLine(
        `[${new Date().toISOString()}] get_screenshot tool called for index ${index}: ${description}`,
      );

      // Display screenshot in the chat stream
      ctx.stream.markdown(`\n📸 **Viewing Screenshot ${index + 1}:**\n\n`);
      if (img.description) {
        ctx.stream.markdown(`*${img.description}*\n\n`);
      }
      
      // Save image to temp file for display
      const tempDir = path.join(os.tmpdir(), 'react-grab-copilot');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const ext = img.type.split('/')[1] || 'png';
      const tempFile = path.join(tempDir, `screenshot-${requestId}-${index}.${ext}`);
      const imageBuffer = Buffer.from(img.data, 'base64');
      fs.writeFileSync(tempFile, imageBuffer);
      
      const md = new vscode.MarkdownString();
      md.supportHtml = true;
      md.appendMarkdown(`<img src="${vscode.Uri.file(tempFile).toString()}" alt="Screenshot ${index + 1}" style="max-width: 100%; max-height: 400px;" />\n\n`);
      ctx.stream.markdown(md);
      ctx.stream.reference(vscode.Uri.file(tempFile));

      // Return the image data in a format that can be added to the conversation
      return {
        text: `Screenshot ${index + 1} retrieved: ${description}`,
        image: {
          data: img.data,
          mimeType: img.type,
          description: description,
        },
      };
    },
  };
}
