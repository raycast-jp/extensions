import {
  ActionPanel,
  List,
  Action,
  Icon,
  getSelectedText,
  showToast,
  Toast,
  Color,
  AI,
  environment,
} from "@raycast/api";
import { useState, useEffect } from "react";

interface ReplyType {
  id: string;
  title: string;
  icon: Icon;
  description: string;
  length: string;
}

const replyTypes: ReplyType[] = [
  {
    id: "short",
    title: "Short",
    icon: Icon.Message,
    description: "Concise and focused reply",
    length: "~1 lines",
  },
  {
    id: "medium",
    title: "Medium",
    icon: Icon.Text,
    description: "Reply with moderate detail",
    length: "~2-3 lines",
  },
  {
    id: "long",
    title: "Long",
    icon: Icon.Document,
    description: "Detailed and polite reply",
    length: "~5-7 lines",
  },
];

async function generateReply(originalText: string, type: string): Promise<string> {
  if (!environment.canAccess(AI)) {
    throw new Error("Cannot access Raycast AI. Raycast Pro is required.");
  }

  let prompt = "";
  const basePrompt = `Please generate an appropriate reply to the following text.

Original text:
${originalText}

Requirements:
- Reply in the same language as the selected text
- Choose appropriate level of formality based on context
- Generate natural and readable reply text
- Choose appropriate reply style based on text content and context`;

  switch (type) {
    case "short":
      prompt = `${basePrompt}
- Concise and focused reply (keep to about 1 line)
- Express core response concisely`;
      break;

    case "medium":
      prompt = `${basePrompt}
- Reply with moderate detail (keep to about 2-3 lines)
- Address key points from the original text
- Include reasons or additional explanations as needed`;
      break;

    case "long":
      prompt = `${basePrompt}
- Detailed and polite reply (keep to about 5-7 lines)
- Express detailed views or opinions on the original text
- Include specific examples and detailed explanations for comprehensive content
- Use more polite and considerate expressions`;
      break;

    default:
      prompt = `${basePrompt}
- General and appropriate reply`;
  }

  try {
    const response = await AI.ask(prompt, {
      creativity: "low",
      model: AI.Model["Google_Gemini_2.5_Flash"],
    });
    return response;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw new Error("Failed to generate AI reply.");
  }
}

export default function Command() {
  const [selectedText, setSelectedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [generatedReplies, setGeneratedReplies] = useState<{ [key: string]: string }>({});
  const [generatingReply, setGeneratingReply] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    async function fetchSelectedText() {
      try {
        const text = await getSelectedText();
        if (text && text.trim()) {
          setSelectedText(text.trim());
        } else {
          setError("No text selected");
        }
      } catch {
        setError("Could not retrieve selected text");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSelectedText();
  }, []);

  // Start AI generation in parallel once text is set
  useEffect(() => {
    if (selectedText && !error) {
      // Start generation for all reply types in parallel
      replyTypes.forEach((replyType) => {
        generateReplyForType(replyType.id);
      });
    }
  }, [selectedText, error]);

  const generateReplyForType = async (type: string) => {
    if (generatedReplies[type] || generatingReply[type]) return;

    setGeneratingReply((prev) => ({ ...prev, [type]: true }));
    try {
      const reply = await generateReply(selectedText, type);
      setGeneratedReplies((prev) => ({ ...prev, [type]: reply }));
      showToast({
        title: "Reply Generated",
        message: `${replyTypes.find((r) => r.id === type)?.title} reply completed`,
      });
    } catch (error) {
      console.error("Reply Generation Error:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Generation Error",
        message: error instanceof Error ? error.message : "Failed to generate reply",
      });
    } finally {
      setGeneratingReply((prev) => ({ ...prev, [type]: false }));
    }
  };

  const isShowingDetail = !isLoading && !error && selectedText.length > 0;

  return (
    <List isLoading={isLoading} isShowingDetail={isShowingDetail}>
      {error && (
        <List.EmptyView
          title="Error"
          description={error}
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy Error Message" content={error} />
            </ActionPanel>
          }
        />
      )}
      {!isLoading &&
        !error &&
        selectedText &&
        replyTypes.map((replyType, index) => {
          const reply = generatedReplies[replyType.id];
          const isGenerating = generatingReply[replyType.id];
          const replyLines = reply ? reply.split("\n").length : 0;

          return (
            <List.Item
              key={replyType.id}
              icon={replyType.icon}
              title={replyType.title}
              subtitle={`⌘${index + 1}${isGenerating ? " (Generating...)" : reply ? " (Generated)" : ""}`}
              detail={
                <List.Item.Detail
                  markdown={
                    reply
                      ? `## Suggested Reply\n\n${reply}`
                      : isGenerating
                        ? "## Generating...\n\nPlease wait a moment."
                        : "## Waiting for generation...\n\nThe reply is being generated..."
                  }
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="Type" text={replyType.title} />
                      <List.Item.Detail.Metadata.Label title="Description" text={replyType.description} />
                      <List.Item.Detail.Metadata.Label
                        title="Expected Length"
                        text={replyType.length}
                        icon={{ source: Icon.Text, tintColor: Color.Blue }}
                      />
                      {reply && (
                        <List.Item.Detail.Metadata.Label
                          title="Actual Lines"
                          text={`${replyLines} lines`}
                          icon={{ source: Icon.List, tintColor: Color.Green }}
                        />
                      )}
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label
                        title="Original Text"
                        text={selectedText.substring(0, 100) + (selectedText.length > 100 ? "..." : "")}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Character Count"
                        text={`${selectedText.length} characters`}
                        icon={{ source: Icon.Document, tintColor: Color.Orange }}
                      />
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label
                        title="Generation Status"
                        text={isGenerating ? "Generating..." : reply ? "Generated" : "Waiting to start"}
                        icon={{
                          source: Icon.Stars,
                          tintColor: isGenerating ? Color.Orange : reply ? Color.Green : Color.SecondaryText,
                        }}
                      />
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              accessories={[
                {
                  text: replyType.length,
                  icon: {
                    source: isGenerating ? Icon.Clock : reply ? Icon.CheckCircle : replyType.icon,
                    tintColor: isGenerating ? Color.Orange : reply ? Color.Green : Color.Blue,
                  },
                  tooltip: `${replyType.title}: ${replyType.description}`,
                },
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section title={`${replyType.title} Reply`}>
                    {reply && (
                      <Action.CopyToClipboard
                        icon={Icon.Clipboard}
                        title={`Copy ${replyType.title} Reply`}
                        content={reply}
                        onCopy={() => showToast({ title: `${replyType.title} reply copied` })}
                      />
                    )}
                    {reply && (
                      <Action
                        icon={Icon.Stars}
                        title={`Regenerate ${replyType.title} Reply`}
                        onAction={() => {
                          setGeneratedReplies((prev) => {
                            const newReplies = { ...prev };
                            delete newReplies[replyType.id];
                            return newReplies;
                          });
                          generateReplyForType(replyType.id);
                        }}
                      />
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section title="Others">
                    <Action.CopyToClipboard
                      icon={Icon.Text}
                      title="Copy Original Text"
                      content={selectedText}
                      onCopy={() => showToast({ title: "Original text copied" })}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
    </List>
  );
}
